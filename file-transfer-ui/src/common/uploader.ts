import { UploadFile } from './uploadFile'

import { ChunkResultTF, STATUS, UploaderDefaultOptionsIF, UploaderFileInfoIF, UploaderUserOptionsIF } from '../types'
import { MyEvent } from './myEvent'
import axios from 'axios'
import * as SparkMD5 from 'spark-md5'

/**
 * 上传器类
 */
export class Uploader extends MyEvent {
  // 上传文件列表
  public uploadFileList:UploadFile[]
  // 上传器配置项
  public uploaderOptions:UploaderDefaultOptionsIF

  constructor(options:UploaderUserOptionsIF) {
    super()
    // 合并默认值配置和自定义配置
    this.uploaderOptions = Object.assign(optionsDefaults, options)
    this.eventData = {}
    this.uploadFileList = []
  }

  /**
   * 增加上传文件
   * @param fileList 文件列表
   */
  addFiles(fileList:FileList) {
    Array.from(fileList).forEach((file:File) => {
      this.beforeUploadFile(file)
    })
  }

  /**
   * 文件上传前处理
   * @param file 需要上传的文件
   */
  private async beforeUploadFile(file: File) {
    // 生成UploadFile对象
    const uploadFile = new UploadFile(file, this.uploaderOptions)
    // 获取文件的唯一标识
    const uniqueIdentifier = await this.generateUniqueIdentifier(file)
    // 设置UploadFile的唯一标识
    uploadFile.uniqueIdentifier = uniqueIdentifier
    // 设置UploadFile初始暂停状态
    uploadFile.isPaused = !this.uploaderOptions.isAutoStart

    // 文件校验
    if (this.checkFile(file)) {
      // 如果该文件未上传 则添加至上传文件列表中
      if (this.IsUniqueIdentifier(uniqueIdentifier)) {
        // 绑定监听事件
        uploadFile.on('onFileProgress', this.fileProgressEvent)
        this.uploadFileList.push(uploadFile)
        // 触发文件增加事件
        this.trigger('onFileAdd', this.getUploaderFileInfo(uploadFile))
        // 如果需要自动上传
        if (this.uploaderOptions.isAutoStart) {
          this.startUploadFile(uploadFile)
        }
      } else {
        uploadFile.state = STATUS.SUCCESS
        uploadFile.currentProgress = 100
        uploadFile.message = '文件已经在上传列表中'
        this.trigger('onFileSuccess', this.getUploaderFileInfo(uploadFile))
      }
    } else {
      // 触发文件增加事件
      this.trigger('onFileAdd', this.getUploaderFileInfo(uploadFile))
      uploadFile.state = STATUS.ERROR
      uploadFile.message = '文件校验失败'
      this.trigger('onFileFailed', this.getUploaderFileInfo(uploadFile))
    }
  }

  /**
   * 校验上传文件
   * @param file 文件
   */
  private checkFile(file: File):boolean {
    // 如果文件大小小于0或者大于最大值 则校验失败
    if (file.size <= 0 || file.size > this.uploaderOptions.fileMaxSize) {
      return false
    }

    // 获取文件名后缀
    const fileType = file.name.replace(/.+\./, '')
    // 可上传文件类型列表中不包含该文件类型 则校验失败
    if (this.uploaderOptions.fileTypeLimit.length !== 0) {
      return this.uploaderOptions.fileTypeLimit.includes(fileType)
    } else {
      return true
    }
  }

  /**
   * 获取文件的唯一标识
   * @returns 文件的唯一标识
   * @param file 文件
   */
  private async generateUniqueIdentifier(file:File) {
    // 采用MD5算法生成校验字符串
    let spark = new SparkMD5.ArrayBuffer()
    const chunkCount = Math.ceil(file.size / this.uploaderOptions.chunkSize)

    // 如果传入的是大文件 则MD5计算时间较长
    // 因此采用第1个文件块和最后一个文件块的方式组合计算MD5 确保文件唯一
    // TODO 采用此方法大文件计算MD5还是比较慢 需要优化
    spark = await this.getFileSparkMD5(spark, file.slice(0, Math.min(this.uploaderOptions.chunkSize, file.size)))
    // 如果有超过2个文件块
    if (chunkCount > 1) {
      const endByte = Math.min(this.uploaderOptions.chunkSize * (chunkCount - 1), file.size)
      spark = await this.getFileSparkMD5(spark, file.slice(this.uploaderOptions.chunkSize, endByte))
    }

    // 返回计算的值
    return spark.end()
  }

  /**
   * 获取文件块的MD5校验值
   * @param spark SparkMD5实例
   * @param chunkBytes 文件块字节
   * @private
   */
  private getFileSparkMD5(spark:SparkMD5.ArrayBuffer, chunkBytes: Blob) {
    return new Promise<SparkMD5.ArrayBuffer>((resolve, reject) => {
      const fileReader = new FileReader()
      fileReader.readAsArrayBuffer(chunkBytes)

      // 加载文件
      fileReader.onload = (event:ProgressEvent) => {
        // 增加MD5信息
        spark.append((event.target as any).result)
        resolve(spark)
      }

      // 加载文件
      fileReader.onerror = () => {
        reject('读取文件失败')
      }
    })
  }

  /**
   * 判断文件是否在上传文件列表中
   * @param uniqueIdentifier 文件唯一标识
   * @returns 是否在上传文件列表中
   */
  private IsUniqueIdentifier(uniqueIdentifier:string):boolean {
    // 防止多次上传同一个文件
    // 如果每个文件的标识都不等于该标识 则认为该文件不在上传列表中
    return this.uploadFileList.every((uploadFile) => {
      return uploadFile.uniqueIdentifier !== uniqueIdentifier
    })
  }

  /**
   * 开始上传文件块
   * @param uploadFile 上传文件信息
   */
  public startUploadFile(uploadFile: UploadFile) {
    uploadFile.checkSkipUploadFile()
      .then((response:any) => {
        const chunkResult:ChunkResultTF = response.data.data.chunkResult
        if (chunkResult.skipUpload) {
          uploadFile.currentProgress = 100
          uploadFile.message = '文件已经存在服务器中'
          this.fileSuccessEvent(uploadFile)
        } else {
          // 生成文件块
          uploadFile.generateChunks(chunkResult.uploadedChunkList.length)
          // 并发上传文件块
          uploadFile.concurrentUploadFile()
          // 上传成功
            .then(() => {
              this.fileSuccessEvent(uploadFile)
            })
          // 上传失败
            .catch((error) => {
              uploadFile.message = error.message
              this.fileErrorEvent(uploadFile)
            })
        }
      }).catch((error) => {
        uploadFile.message = error.message
        this.fileErrorEvent(uploadFile)
      })
  }

  /**
   * 获取上传文件信息
   * @param uploadFile 上传文件对象
   */
  private getUploaderFileInfo(uploadFile: UploadFile):UploaderFileInfoIF {
    return {
      name: uploadFile.name,
      size: uploadFile.size,
      uniqueIdentifier: uploadFile.uniqueIdentifier,
      state: uploadFile.state,
      currentProgress: uploadFile.currentProgress,
      currentSpeed: uploadFile.currentSpeed,
      timeRemaining: uploadFile.timeRemaining,
      isPause: uploadFile.isPaused,
      message: uploadFile.message,
    }
  }

  /**
   * 上传中事件
   */
  private fileProgressEvent = (uploadFile: UploadFile) => {
    // 找到正在处理的文件
    const index = this.getUploadFileIndex(uploadFile.uniqueIdentifier)
    // 触发上传器上传中事件
    this.trigger('onUploaderProgress', this.getUploaderFileInfo(this.uploadFileList[index]))
  }

  /**
   * 上传成功事件
   * @param uploadFile 上传文件
   */
  private fileSuccessEvent = (uploadFile:UploadFile) => {
    // 合并文件
    const uploadFolderPath = this.uploaderOptions.uploadFolderPath
    axios({
      url: this.uploaderOptions.mergeUrl,
      method: 'post',
      data: uploadFile,
      params: { uploadFolderPath },
      responseType: 'blob',
    })
      .then((response:any) => {
        if (response.status === 200) {
          uploadFile.state = STATUS.SUCCESS
          // 触发上传器上传成功事件
          this.trigger('onFileSuccess', this.getUploaderFileInfo(uploadFile))
        } else {
          uploadFile.state = STATUS.ERROR
          uploadFile.message = response.message
          // 触发上传器上传失败事件
          this.trigger('onFileFailed', this.getUploaderFileInfo(uploadFile))
        }
      })
      .catch((error) => {
        uploadFile.state = STATUS.ERROR
        uploadFile.message = error.message
        // 触发上传器上传失败事件
        this.trigger('onFileFailed', this.getUploaderFileInfo(uploadFile))
      })
  }

  /**
   * 上传失败事件
   */
  private fileErrorEvent = (uploadFile:UploadFile) => {
    uploadFile.state = STATUS.ERROR
    // 触发上传器上传失败事件
    this.trigger('onFileFailed', this.getUploaderFileInfo(uploadFile))
  }

  /**
   * 取消文件上传
   * @param uploadFileInfo 文件信息
   */
  public cancelUpload(uploadFileInfo:UploaderFileInfoIF):number {
    const index = this.getUploadFileIndex(uploadFileInfo.uniqueIdentifier)

    this.uploadFileList[index].cancelUploadFile()
    this.uploadFileList[index].deleteUploadChunk()
    this.uploadFileList.splice(index, 1)

    return index
  }

  /**
   * 暂停文件上传
   * @param uploadFileInfo 文件信息
   */
  public pauseUpload(uploadFileInfo:UploaderFileInfoIF) {
    const index = this.getUploadFileIndex(uploadFileInfo.uniqueIdentifier)

    this.uploadFileList[index].pauseUploadFile()
  }

  /**
   * 恢复文件上传
   * @param uploadFileInfo 文件信息
   */
  public resumeUpload(uploadFileInfo:UploaderFileInfoIF) {
    const index = this.getUploadFileIndex(uploadFileInfo.uniqueIdentifier)

    this.uploadFileList[index].resumeUploadFile()
  }

  /**
   * 获取当前上传文件的索引值
   * @param uniqueIdentifier 文件唯一标识
   */
  private getUploadFileIndex(uniqueIdentifier:string):number {
    return this.uploadFileList.findIndex((item) => {
      return item.uniqueIdentifier === uniqueIdentifier
    })
  }

  /**
   * Assign a browse action to one or more DOM nodes.
   * @function
   * @param {Element|Array.<Element>} domNode
   * @param {boolean} isDirectory Pass in true to allow directories to
   * @param {boolean} singleFile prevent multi file upload
   *  http://www.w3.org/TR/html-markup/input.file.html#input.file-attributes
   *  eg: accept: 'image/*'
   * be selected (Chrome only).
   */
  assignBrowse(domNode:HTMLElement, isDirectory:boolean, singleFile:boolean) {
    let inputElement:HTMLElement

    // 如果是Input类型
    if (domNode.tagName === 'INPUT') {
      inputElement = domNode
    } else {
      // 如果不是input类型 则创建input元素
      inputElement = document.createElement('input')
      inputElement.setAttribute('type', 'file')
      inputElement.style.visibility = 'hidden'
      inputElement.style.position = 'absolute'
      inputElement.style.width = '1px'
      inputElement.style.height = '1px'

      domNode.appendChild(inputElement)
    }

    if (!this.uploaderOptions.isSingleFile && !singleFile) {
      inputElement.setAttribute('multiple', 'multiple')
    }

    if (isDirectory) {
      inputElement.setAttribute('webkitdirectory', 'webkitdirectory')
    }

    // attributes && common.each(attributes, function(value, key) {
    //   input.setAttribute(key, value)
    // })

    // 监听Input事件
    inputElement.addEventListener('change', (event:Event) => {
      const inputElement = event.target as HTMLInputElement

      // 如果选择了文件 则将其加入到上传文件列表中
      if (inputElement.value && inputElement.files !== null) {
        this.addFiles(inputElement.files)
        inputElement.value = ''
      }
    }, false)
  }
}

const optionsDefaults:UploaderDefaultOptionsIF = {
  fileMaxSize: 200 * 1024 * 1024,
  chunkSize: 5 * 1024 * 1024,
  // BUG TODO 如果是并发上传 会导致计算的速度有问题 原因是this.startTime的位置有问题
  simultaneousUploads: 1,
  maxChunkRetries: 3,
  isSingleFile: true,
  successCode: [20000],
  fileTypeLimit: [],
  isAutoStart: true,
  uploadUrl: '/',
  mergeUrl: '/',
  fileParameterName: 'multipartFile',
  uploadFolderPath: '/',
}

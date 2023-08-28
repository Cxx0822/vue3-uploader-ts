import { UploadFile } from './uploadFile'

import { STATUS, IUploaderOptions, IUploaderFileInfo, IUploaderUserOptions } from '@/types'
import { MyEvent } from './myEvent'
import * as SparkMD5 from 'spark-md5'
import { mergeFile } from '@/api/uploadService.ts'
import { UploadFileQueue } from '@/common/UploadFileQueue.ts'

/**
 * 上传器类
 */
export class Uploader extends MyEvent {
  // 上传器配置项
  uploaderOptions: IUploaderOptions
  // 上传文件列表
  uploadFileQueue: UploadFileQueue<UploadFile>

  constructor(options: IUploaderUserOptions) {
    super()
    // 合并默认值配置和自定义配置
    this.uploaderOptions = Object.assign(optionsDefaults, options)
    this.eventData = {}
    // 上传文件列表
    this.uploadFileQueue = new UploadFileQueue()
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
  assignBrowse(domNode: HTMLElement, isDirectory: boolean, singleFile: boolean) {
    let inputElement: HTMLElement

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

    // 监听选择文件事件
    inputElement.addEventListener('change', (event: Event) => {
      const htmlInputElement = event.target as HTMLInputElement

      // 如果选择了文件 则将其加入到上传文件列表中
      if (htmlInputElement.value && htmlInputElement.files !== null) {
        this.addUploadFiles(htmlInputElement.files)
        htmlInputElement.value = ''
      }
    }, false)
  }

  /**
   * 增加上传文件
   * @param fileList 文件列表
   */
  addUploadFiles(fileList: FileList) {
    // 处理每个选择的文件
    Array.from(fileList).forEach(async (file: File) => {
      // 生成UploadFile对象
      const uploadFile: UploadFile = new UploadFile(file, this.uploaderOptions)
      // 预处理上传文件
      await this.beforeUploadFile(uploadFile, file)

      // 文件校验
      if (this.checkUploadFile(uploadFile, file)) {
        uploadFile.message = '文件校验成功'
        this.trigger('onUploaderProgress', uploadFile)
        // 判断文件是否在上传中
        if (this.checkIsUniqueIdentifier(uploadFile)) {
          // this.startUploadFile(uploadFile)
          this.insertQueue(uploadFile)
          uploadFile.message = '文件添加至上传队列中'
          this.trigger('onUploaderProgress', uploadFile)

          // 如果需要自动上传并且当前没有正在上传的文件 则开始上传
          if (this.uploaderOptions.isAutoStart && this.uploadFileQueue.size() === 1) {
            this.startUploadFile(this.getCurrentUploadFile())
          }
        } else {
          // 触发文件已经在上传列表中事件
          uploadFile.message = '文件已经在上传列表中'
          this.triggerUploadFileEvent('onFileSuccess', uploadFile)
        }
      } else {
        // 触发文件增加事件
        this.trigger('onFileAdd', this.getUploaderFileInfo(uploadFile))
        uploadFile.message = '文件校验失败'
        this.triggerUploadFileEvent('onFileFailed', uploadFile)
      }
    })
  }

  /**
   * 开始上传文件块
   * @param uploadFile 上传文件信息
   */
  startUploadFile(uploadFile: UploadFile) {
    uploadFile.message = '准备上传文件'
    this.trigger('onUploaderProgress', uploadFile)
    // 判断是否需要跳过上传 即服务器是否存在文件
    uploadFile.checkSkipUploadFile()
      .then((response) => {
        const { chunkResult } = response.data
        if (chunkResult.skipUpload) {
          uploadFile.message = '文件已经存在服务器中'
          this.triggerUploadFileEvent('onFileSuccess', uploadFile)
        } else {
          // 上传文件块
          this.uploadChunkInfo(uploadFile, chunkResult.uploadedChunkList.length)
        }
      }).catch(() => {
        uploadFile.message = '服务器连接错误'
        this.triggerUploadFileEvent('onFileFailed', uploadFile)
      })
  }

  /**
   * 取消文件上传
   * @param uploadFileInfo 文件信息
   */
  cancelUpload(uploadFileInfo: IUploaderFileInfo): number {
    const index = this.getUploadFileIndex(uploadFileInfo.uniqueIdentifier)

    this.uploadFileQueue.getAll()[index].cancelUploadFile()
    this.uploadFileQueue.getAll()[index].deleteUploadChunk()
    this.uploadFileQueue.getAll().splice(index, 1)

    return index
  }

  /**
   * 暂停文件上传
   * @param uploadFileInfo 文件信息
   */
  pauseUpload(uploadFileInfo: IUploaderFileInfo) {
    const index = this.getUploadFileIndex(uploadFileInfo.uniqueIdentifier)

    this.uploadFileQueue.getAll()[index].pauseUploadFile()
  }

  /**
   * 恢复文件上传
   * @param uploadFileInfo 文件信息
   */
  resumeUpload(uploadFileInfo: IUploaderFileInfo) {
    const index = this.getUploadFileIndex(uploadFileInfo.uniqueIdentifier)

    this.uploadFileQueue.getAll()[index].resumeUploadFile()
  }

  /**
   * 将上传文件添加至队列中
   * @param uploadFile 上传文件
   */
  private insertQueue(uploadFile: UploadFile) {
    this.uploadFileQueue.insertQueue(uploadFile)

    // 绑定监听事件
    uploadFile.on('onFileProgress', this.fileProgressEvent)
    this.trigger('onFileAdd', this.getUploaderFileInfo(uploadFile))
  }

  /**
   * 获取当前上传的文件
   */
  private getCurrentUploadFile() {
    return this.uploadFileQueue.peek()
  }

  /**
   * 文件上传前处理
   * @param uploadFile 上传文件
   * @param file 需要上传的文件
   */
  private async beforeUploadFile(uploadFile: UploadFile, file: File) {
    // 获取文件的唯一标识
    // 设置UploadFile的唯一标识
    uploadFile.uniqueIdentifier = await this.generateUniqueIdentifier(file)
    // 设置UploadFile初始暂停状态
    uploadFile.isPaused = !this.uploaderOptions.isAutoStart
  }

  /**
   * 获取文件的唯一标识
   * @returns 文件的唯一标识
   * @param file 文件
   */
  private async generateUniqueIdentifier(file: File) {
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
   */
  private getFileSparkMD5(spark: SparkMD5.ArrayBuffer, chunkBytes: Blob) {
    return new Promise<SparkMD5.ArrayBuffer>((resolve, reject) => {
      const fileReader = new FileReader()
      fileReader.readAsArrayBuffer(chunkBytes)

      // 加载文件
      fileReader.onload = (event: ProgressEvent) => {
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
   * 校验上传文件
   * @param uploadFile 上传文件
   * @param file 文件
   */
  private checkUploadFile(uploadFile: UploadFile, file: File): boolean {
    // 如果文件大小小于0或者大于最大值 则校验失败
    if (file.size <= 0 || file.size > this.uploaderOptions.fileMaxSize) {
      uploadFile.message = '超出上传文件最大值'
      return false
    }

    // 获取文件名后缀
    const fileType: string = file.name.replace(/.+\./, '')
    // 可上传文件类型列表中不包含该文件类型 则校验失败
    if (this.uploaderOptions.fileTypeLimit.length !== 0) {
      const isInclude = this.uploaderOptions.fileTypeLimit.includes(fileType)
      if (!isInclude) uploadFile.message = '不在上传文件类型中'
      return isInclude
    } else {
      return true
    }
  }

  /**
   * 判断文件是否在上传文件列表中
   * @param uploadFile 上传文件
   */
  private checkIsUniqueIdentifier(uploadFile: UploadFile): boolean {
    // 防止多次上传同一个文件
    // 如果每个文件的标识都不等于该标识 则认为该文件不在上传列表中
    return this.uploadFileQueue.getAll().every((item) => {
      return item.uniqueIdentifier !== uploadFile.uniqueIdentifier
    })
  }

  /**
   * 上传文件块
   * @param uploadFile 上传文件
   * @param chunkLength 文件块长度
   * @private
   */
  private uploadChunkInfo(uploadFile: UploadFile, chunkLength: number) {
    // 生成文件块
    uploadFile.generateChunks(chunkLength)
    // 并发上传文件块
    uploadFile.concurrentUploadFile()
      // 上传成功
      .then(() => {
        this.fileSuccessEvent(uploadFile)
      })
      // 上传失败
      .catch(() => {
        uploadFile.message = '上传文件块错误'
        this.triggerUploadFileEvent('onFileFailed', uploadFile)
      })
  }

  /**
   * 获取上传文件信息
   * @param uploadFile 上传文件对象
   */
  private getUploaderFileInfo(uploadFile: UploadFile): IUploaderFileInfo {
    return {
      name: uploadFile.name,
      size: uploadFile.size,
      uniqueIdentifier: uploadFile.uniqueIdentifier,
      state: uploadFile.state,
      currentProgress: uploadFile.currentProgress,
      currentSpeed: uploadFile.currentSpeed,
      timeRemaining: uploadFile.timeRemaining,
      isPause: uploadFile.isPaused,
      message: uploadFile.message
    }
  }

  /**
   * 上传中事件
   */
  private fileProgressEvent = (uploadFile: UploadFile) => {
    // 找到正在处理的文件
    const index = this.getUploadFileIndex(uploadFile.uniqueIdentifier)
    // 触发上传器上传中事件
    this.trigger('onUploaderProgress', this.getUploaderFileInfo(this.uploadFileQueue.getAll()[index]))
  }

  /**
   * 上传成功事件
   * @param uploadFile 上传文件
   */
  private fileSuccessEvent = (uploadFile: UploadFile) => {
    // 合并文件
    this.mergeUploadFile(uploadFile)
      .then(() => {
        uploadFile.message = '上传文件成功'
        this.triggerUploadFileEvent('onFileSuccess', uploadFile)
      })
      .catch(() => {
        // 触发上传器上传失败事件
        uploadFile.message = '合并文件错误'
        this.triggerUploadFileEvent('onFileFailed', uploadFile)
      })
  }

  /**
   * 合并上传文件
   * @param uploadFile 上传文件
   */
  private async mergeUploadFile(uploadFile: UploadFile) {
    return await mergeFile(this.uploaderOptions.serviceIp + this.uploaderOptions.mergeUrl,
      uploadFile, this.uploaderOptions.uploadFolderPath)
  }

  /**
   * 获取当前上传文件的索引值
   * @param uniqueIdentifier 文件唯一标识
   */
  private getUploadFileIndex(uniqueIdentifier: string): number {
    return this.uploadFileQueue.getAll().findIndex((item) => {
      return item.uniqueIdentifier === uniqueIdentifier
    })
  }

  /**
   * 触发上传文件事件
   * @param triggerType 触发类型
   * @param uploadFile 上传文件
   */
  private triggerUploadFileEvent(triggerType: string, uploadFile: UploadFile) {
    switch (triggerType) {
      case 'onFileProgress':
        uploadFile.state = STATUS.SUCCESS
        uploadFile.currentProgress = 100
        break
      case 'onFileFailed':
        uploadFile.state = STATUS.ERROR
        break
      default:
        break
    }

    this.trigger(triggerType, this.getUploaderFileInfo(uploadFile))

    // 如果当前上传队列中存在文件 则出列并上传队首
    if (this.uploadFileQueue.size() > 1) {
      this.uploadFileQueue.deleteQueue()
      this.startUploadFile(this.getCurrentUploadFile())
    }
  }
}

const optionsDefaults: IUploaderOptions = {
  fileMaxSize: 200 * 1024 * 1024,
  chunkSize: 5 * 1024 * 1024,
  // BUG TODO 如果是并发上传 会导致计算的速度有问题 原因是this.startTime的位置有问题
  simultaneousUploads: 1,
  maxChunkRetries: 3,
  isSingleFile: true,
  successCode: [20000],
  fileTypeLimit: [],
  isAutoStart: true,
  serviceIp: '',
  uploadUrl: '',
  mergeUrl: '',
  uploadFolderPath: '',
  fileParameterName: '',
  headers: {}
}

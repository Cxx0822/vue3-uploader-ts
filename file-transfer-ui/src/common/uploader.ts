import { UploadFile } from './uploadFile'

import { STATUS, IUploaderOptions, IUploaderFileInfo, IUploaderUserOptions } from '@/types'
import { MyEvent } from './myEvent'
import { mergeFile } from '@/api/uploadService.ts'
import { UploadFileQueue } from '@/common/UploadFileQueue.ts'
import { generateUniqueIdentifier } from '@//utils'

/**
 * 上传器类
 */
export class Uploader extends MyEvent {
  // 上传器配置项
  uploaderOptions: IUploaderOptions
  // 上传文件唯一标识列表
  uploadFileUniqueIdentifierList: string[]
  // 上传文件列表
  uploadFileQueue: UploadFileQueue<UploadFile>
  // 当前上传文件
  currentUploadFile: UploadFile
  // 新选择的文件
  newUploadFile: UploadFile
  // 上传文件消息
  uploadFileMessage: string
  // 是否正在上传文件
  hasUploadingFile: boolean

  constructor(options: IUploaderUserOptions) {
    super()
    // 合并默认值配置和自定义配置
    this.uploaderOptions = Object.assign(optionsDefaults, options)
    this.eventData = {}
    this.uploadFileUniqueIdentifierList = []
    // 上传文件列表
    this.uploadFileQueue = new UploadFileQueue()
    // @ts-ignore
    this.currentUploadFile = null
    // @ts-ignore
    this.newUploadFile = null
    this.uploadFileMessage = ''
    this.hasUploadingFile = false
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
      // 支持多选文件
      inputElement.setAttribute('multiple', 'multiple')
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
    inputElement.addEventListener('change', async (event: Event) => {
      const htmlInputElement = event.target as HTMLInputElement

      // 如果选择了文件 则将其加入到上传文件列表中
      if (htmlInputElement.value && htmlInputElement.files !== null) {
        await this.addUploadFiles(htmlInputElement.files)

        // 如果需要自动上传并且当前没有正在上传的文件 则开始上传
        if (!this.hasUploadingFile
          && this.uploaderOptions.isAutoStart
          && this.uploadFileQueue.getAll().length > 0) {
          this.startUploadFile()
        }

        htmlInputElement.value = ''
      }
    }, false)
  }

  /**
   * 增加上传文件
   * @param fileList 文件列表
   */
  async addUploadFiles(fileList: FileList) {
    const fileListArray = Array.from(fileList)

    // 不能在foreach等带返回值的遍历语法中使用异步！
    // foreach等都是同步的 用普通的for循环即可
    for (let i = 0; i < fileListArray.length; i++) {
      // 生成UploadFile对象
      this.newUploadFile = new UploadFile(fileListArray[i], this.uploaderOptions)

      // 预处理上传文件
      await this.preprocessUploadFile(fileListArray[i])
        .then(() => {
          // 文件校验
          if (this.checkUploadFile(fileListArray[i])) {
            // 判断文件是否在上传中
            if (this.checkIsUniqueIdentifier()) {
              // 添加至文件唯一标识列表中
              this.uploadFileUniqueIdentifierList.push(this.newUploadFile.uniqueIdentifier)
              // 添加至队列中
              this.insertQueue()
              this.triggerUploadFileEvent('onUploaderProgress', this.newUploadFile, '文件添加至上传队列中')
            } else {
              // 触发文件已经在上传列表中事件
              this.triggerUploadFileEvent('onFileSuccess', this.newUploadFile, '文件已经在上传列表中')
            }
          } else {
            // 触发文件增加事件
            this.trigger('onFileAdd', this.getUploaderFileInfo(this.newUploadFile))
            this.triggerUploadFileEvent('onFileFailed', this.newUploadFile, this.uploadFileMessage)
          }
        })
        .catch(() => {
          this.uploadFileMessage = '预处理错误'
          this.triggerUploadFileEvent('onFileFailed', this.newUploadFile, this.uploadFileMessage)
        })
    }
  }

  /**
   * 开始上传文件块
   */
  startUploadFile() {
    this.hasUploadingFile = true
    // console.log(this.getCurrentUploadFile())
    this.currentUploadFile = this.getCurrentUploadFile()
    this.triggerUploadFileEvent('onUploaderProgress', this.currentUploadFile, '准备上传文件')

    // 判断是否需要跳过上传 即服务器是否存在文件
    this.currentUploadFile.checkSkipUploadFile()
      .then((response) => {
        const { chunkResult } = response.data
        if (chunkResult.skipUpload) {
          this.triggerUploadFileEvent('onFileSuccess', this.currentUploadFile, '文件已经存在服务器中')
        } else {
          this.triggerUploadFileEvent('onUploaderProgress', this.currentUploadFile, '上传文件块中')

          // 上传文件块
          this.uploadChunkInfo(chunkResult.uploadedChunkList.length)
        }
      })
      .catch(() => {
        this.triggerUploadFileEvent('onFileFailed', this.currentUploadFile, '服务器连接错误')
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
   */
  private insertQueue() {
    this.uploadFileQueue.insertQueue(this.newUploadFile)

    // 绑定监听事件
    this.uploadFileQueue.tail().on('onFileProgress', () => {
      // 触发上传器上传中事件
      this.trigger('onUploaderProgress', this.getUploaderFileInfo(this.newUploadFile))
    })

    this.trigger('onFileAdd', this.getUploaderFileInfo(this.newUploadFile))
  }

  /**
   * 获取当前上传的文件
   */
  private getCurrentUploadFile() {
    return this.uploadFileQueue.peek()
  }

  /**
   * 文件上传前处理
   * @param file 需要上传的文件
   */
  private async preprocessUploadFile(file: File) {
    this.triggerUploadFileEvent('onUploaderProgress', this.newUploadFile, '文件预处理中')

    // 设置UploadFile的唯一标识
    const { chunkSize } = this.uploaderOptions
    this.newUploadFile.uniqueIdentifier = await generateUniqueIdentifier(file, chunkSize)
    // 设置UploadFile初始暂停状态
    this.newUploadFile.isPaused = !this.uploaderOptions.isAutoStart
  }

  /**
   * 校验上传文件
   * @param file 文件
   */
  private checkUploadFile(file: File): boolean {
    // 如果文件大小小于0或者大于最大值 则校验失败
    if (file.size <= 0 || file.size > this.uploaderOptions.fileMaxSize) {
      this.uploadFileMessage = '文件校验失败 超出上传文件最大值'
      return false
    }

    // 获取文件名后缀
    const fileType: string = file.name.replace(/.+\./, '')
    // 可上传文件类型列表中不包含该文件类型 则校验失败
    if (this.uploaderOptions.fileTypeLimit.length !== 0) {
      const isInclude = this.uploaderOptions.fileTypeLimit.includes(fileType)
      if (!isInclude) this.uploadFileMessage = '文件校验失败 不在上传文件类型中'
      return isInclude
    } else {
      this.uploadFileMessage = '文件校验成功'
      this.trigger('onUploaderProgress', this.getUploaderFileInfo(this.newUploadFile))
      return true
    }
  }

  /**
   * 判断文件是否在上传文件列表中
   */
  private checkIsUniqueIdentifier(): boolean {
    // 防止多次上传同一个文件
    // 如果每个文件的标识都不等于该标识 则认为该文件不在上传列表中
    return this.uploadFileUniqueIdentifierList.every((item) => {
      return item !== this.newUploadFile.uniqueIdentifier
    })
  }

  /**
   * 上传文件块
   * @param chunkLength 文件块长度
   */
  private uploadChunkInfo(chunkLength: number) {
    // 生成文件块
    this.currentUploadFile.generateChunks(chunkLength)
    // 并发上传文件块
    this.currentUploadFile.concurrentUploadFile()
      // 上传成功
      .then(() => {
        this.triggerUploadFileEvent('onUploaderProgress', this.currentUploadFile, '开始合并文件')

        // 合并文件
        this.mergeUploadFile(this.currentUploadFile)
          .then(() => {
            this.triggerUploadFileEvent('onFileSuccess', this.currentUploadFile, '上传文件成功')
          })
          .catch(() => {
            // 触发上传器上传失败事件
            this.triggerUploadFileEvent('onFileFailed', this.currentUploadFile, '合并文件错误')
          })
      })
      // 上传失败
      .catch(() => {
        this.triggerUploadFileEvent('onFileFailed', this.currentUploadFile, '上传文件块错误')
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
   * 获取上传文件信息
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
      message: this.uploadFileMessage
    }
  }

  /**
   * 触发上传文件事件
   * @param triggerType 触发类型
   * @param uploadFile 上传文件
   * @param message 消息
   */
  private triggerUploadFileEvent(triggerType: string, uploadFile: UploadFile, message: string) {
    this.uploadFileMessage = message as string

    switch (triggerType) {
      case 'onUploaderProgress':
        this.trigger('onUploaderProgress', this.getUploaderFileInfo(uploadFile))
        break
      case 'onFileSuccess':
        uploadFile.state = STATUS.SUCCESS
        uploadFile.currentProgress = 100
        break
      case 'onFileFailed':
        uploadFile.state = STATUS.ERROR
        break
      default:
        break
    }

    if (triggerType === 'onUploaderProgress') {
      return
    }

    this.trigger(triggerType, uploadFile)
    this.uploadFileQueue.deleteQueue()

    // 如果当前上传队列中存在文件 则出列并上传队首
    if (this.uploadFileQueue.size() > 0) {
      // this.uploadFileQueue.deleteQueue()
      // this.currentUploadFile = this.getCurrentUploadFile()
      this.startUploadFile()
    } else {
      // 全部上传结束
      this.hasUploadingFile = false
    }
  }
}

const optionsDefaults: IUploaderOptions = {
  fileMaxSize: 200 * 1024 * 1024,
  chunkSize: 2 * 1024 * 1024,
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

import { Chunk } from './chunk'
import { MyEvent } from './myEvent'
import { IUploaderFileInfo, IUploaderOptions, IUploadFileParam, STATUS } from '@/types'
import { ConRequest } from './RequestDecotration'
import { deleteChunk, uploadChunk } from '@/api/uploadService.ts'

export class UploadFile extends MyEvent {
  // 文件对象
  file: File
  // 文件类型
  fileType: string
  // 文件名称
  name: string
  // 文件大小
  size: number
  // 文件路径
  relativePath: string
  // 文件唯一标识
  uniqueIdentifier: string
  // 文件上传状态
  state: STATUS
  // 文件块列表
  chunks: Chunk[]
  // 当前上传速度 单位kb/s
  currentSpeed: number
  // 当前进度 单位 %
  currentProgress: number
  // 剩余时间 单位 s
  timeRemaining: number
  // 消息提示
  message: string
  // 上传器配置项
  private readonly uploaderOption: IUploaderOptions
  private requestInstance: ConRequest

  constructor(file: File, uploaderOption: IUploaderOptions) {
    super()
    this.uploaderOption = uploaderOption
    // 文件信息
    this.file = file
    this.fileType = this.file.type
    this.name = file.name
    this.size = file.size
    this.relativePath = file.webkitRelativePath || this.name
    this.uniqueIdentifier = ''
    this.state = STATUS.PENDING
    this.chunks = []
    this.currentSpeed = 0
    this.currentProgress = 0
    this.timeRemaining = 0
    this.message = ''
    // 创建并发上传对象
    this.requestInstance = new ConRequest(this.uploaderOption.simultaneousUploads)
  }

  /**
   * 判断文件是否存在 并跳过秒传
   */
  async checkSkipUploadFile() {
    const identifier = this.uniqueIdentifier
    const filename = this.name
    const { uploadFolderPath } = this.uploaderOption
    return await uploadChunk(this.uploaderOption.serviceIp + this.uploaderOption.uploadUrl,
      identifier, filename, uploadFolderPath)
  }

  /**
   * 对文件切片 生成文件块
   */
  generateChunks(chunkIndex: number) {
    // 文件块个数
    const chunkNumber = Math.max(Math.ceil(this.size / this.uploaderOption.chunkSize), 1)

    // 生成所有的文件块
    for (let offset = 0; offset < chunkNumber; offset++) {
      // 文件参数信息
      const fileParam: IUploadFileParam = {
        chunkNumber: offset + 1,
        totalSize: this.size,
        identifier: this.uniqueIdentifier,
        filename: this.name,
        fileType: this.fileType,
        relativePath: this.relativePath,
        totalChunks: chunkNumber
      }

      // 文件块对象
      const chunk = new Chunk(this.file, this.uploaderOption, fileParam, offset)
      // 绑定监听事件
      chunk.on('onChunkProgress', this.chunkProgressEvent)
      this.chunks.push(chunk)
    }

    for (let i = 0; i < chunkIndex; i++) {
      this.chunks[i].status = STATUS.SUCCESS
      this.chunks[i].off('onChunkProgress')
    }
  }

  /**
   * 并发上传文件块
   */
  async concurrentUploadFile() {
    // 所有的并发请求Promise
    const uploadPromiseList: Array<Promise<any>> = []
    // 遍历所有的文件块 得到上传文件块的Promise请求
    this.chunks.forEach((chunk) => {
      if (chunk.status !== STATUS.SUCCESS) {
        const promise = this.requestInstance.request(chunk)
        // 每个文件块的promise回调
        promise
          // 上传成功的处理 错误的处理放在Promise.all中
          .then(() => {
            // 取消监听事件
            chunk.off('onChunkProgress')
            // 触发文件块上传成功事件
            this.chunkSuccessEvent()
          })

        uploadPromiseList.push(promise)
      }
    })

    // 开启所有的上传请求
    await Promise.all(uploadPromiseList)
  }

  /**
   * 暂停文件上传
   */
  pauseUploadFile() {
    this.state = STATUS.ABORT
    this.requestInstance.pauseRequesting()
  }

  /**
   * 恢复文件上传
   */
  resumeUploadFile() {
    this.state = STATUS.PROGRESS
    this.requestInstance.resumeRequesting()
  }

  /**
   * 取消文件上传
   */
  cancelUploadFile() {
    this.chunks.forEach((chunk) => {
      if (chunk.status === STATUS.PROGRESS) {
        chunk.cancelUploadChunk()
      }
    })
  }

  /**
   * 删除文件块信息
   */
  deleteUploadChunk() {
    const identifier = this.uniqueIdentifier
    const { uploadFolderPath } = this.uploaderOption
    deleteChunk(this.uploaderOption.serviceIp + this.uploaderOption.uploadUrl,
      identifier, uploadFolderPath).then()
  }

  /**
   * 文件块上传中事件 计算当前速度 进度 剩余时间等
   */
  private chunkProgressEvent = () => {
    this.state = STATUS.PROGRESS
    // 计算当前速度
    this.currentSpeed = this.measureSpeed()
    // 计算当前进度
    this.currentProgress = this.uploadFileProgress()
    // 计算剩余时间
    this.timeRemaining = this.calTimeRemaining()
  }

  /**
   * 文件块上传成功事件
   */
  private chunkSuccessEvent = () => {
    const uploaderFileInfoIF: IUploaderFileInfo = {
      name: this.name,
      size: this.size,
      uniqueIdentifier: this.uniqueIdentifier,
      state: this.state,
      currentProgress: this.currentProgress,
      currentSpeed: this.currentSpeed,
      timeRemaining: this.timeRemaining,
      message: this.message
    }

    // 触发文件上传中事件 并将uploadFileInfo信息返回
    // 注：不能将整个UploadFile对象返回 否则会导致响应式很慢甚至丢失！
    this.trigger('onFileProgress', uploaderFileInfoIF)

    // 判断是否全部完成
    if (this.isCompleted()) {
      // 取消监听事件
      this.off('onFileProgress')
      this.off('onFileAdd')
    }
  }

  /**
   * 计算已上传文件的大小
   * @returns 已上传文件大小
   */
  private sizeUploaded(): number {
    let size = 0

    // 遍历所有文件块 计算已上传文件的大小
    this.chunks.forEach((chunk: Chunk) => {
      size += chunk.sizeUploaded()
    })

    return size
  }

  /**
   * 判断文件是否上传完成
   * @returns 是否全部完成
   */
  private isCompleted(): boolean {
    // 遍历所有文件块 判断是否都上传完成
    return this.chunks.every((chunk) =>
      chunk.status === STATUS.SUCCESS)
  }

  /**
   * 获取文件上传进度
   * @returns 当前文件上传进度
   */
  private uploadFileProgress(): number {
    let fileProgress = 0

    // 遍历所有文件块 计算当前上传进度
    this.chunks.forEach((chunk) => {
      fileProgress += chunk.chunkProgress()
    })

    return Math.round((fileProgress / this.chunks.length) * 100)
  }

  /**
   * 计算当前文件传输速度 单位kb/s
   * 计算方法：当前正在上传文件块的平均传输速度
   */
  private measureSpeed(): number {
    let isUploadChunkCount = 0
    let fileSpeed = 0
    this.chunks.forEach((chunk) => {
      if (chunk.status === STATUS.PROGRESS) {
        isUploadChunkCount++
        fileSpeed += chunk.measureSpeed()
      }
    })

    return Math.round(fileSpeed / isUploadChunkCount)
  }

  /**
   * 计算剩余时间 单位秒
   * 计算方法：总字节数-已上传字节数 / 当前字节上传速度
   */
  private calTimeRemaining() {
    return Math.round(((this.size - this.sizeUploaded()) / this.currentSpeed) / 1000)
  }
}

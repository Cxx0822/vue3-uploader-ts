import { Chunk, STATUS } from './chunk'
import { MyEvent } from './myEvent'
import { FileParamIF, UploaderDefaultOptionsIF, UploaderFileInfoIF } from '../types'
import { ConRequest } from './RequestDecotration'

export class UploadFile extends MyEvent {
  // 上传器配置项
  private readonly uploaderOption:UploaderDefaultOptionsIF
  // 文件对象
  public file:File
  // 文件类型
  public fileType:string
  // 文件名称
  public name:string
  // 文件大小
  public size:number
  // 文件路径
  public relativePath:string
  // 文件块列表
  public chunks:Chunk[]
  // 当前上传的文件块个数
  private readonly uploadChunkNumber:number

  // 是否暂停
  private isPaused:boolean
  // 是否错误
  private isError:boolean
  // 是否上传完成
  private isAllComplete:boolean
  // 是否中断
  private isAborted:boolean
  // 当前上传速度 单位kb/s
  public currentSpeed:number
  // 当前进度 单位 %
  public currentProgress:number
  // 剩余时间 单位 s
  public timeRemaining:number
  // 文件唯一标识
  public uniqueIdentifier:string

  constructor(file:File, uploaderOption:UploaderDefaultOptionsIF) {
    super()
    this.uploaderOption = uploaderOption
    // 文件信息
    this.file = file
    this.fileType = this.file.type
    this.name = file.name
    this.size = file.size
    this.relativePath = file.webkitRelativePath || this.name
    this.chunks = []

    // 状态信息
    this.isPaused = false
    this.isError = false
    this.isAllComplete = false
    this.isAborted = false

    this.currentSpeed = 0
    this.currentProgress = 0
    this.timeRemaining = 0

    this.uploadChunkNumber = 0
    this.uniqueIdentifier = ''
  }

  /**
   * 对文件切片 生成文件块
   */
  public generateChunks() {
    // 文件块个数
    const chunkNumber = Math.max(Math.ceil(this.size / this.uploaderOption.chunkSize), 1)

    // 生成所有的文件块
    for (let offset = 0; offset < chunkNumber; offset++) {
      // 文件参数信息
      const fileParam:FileParamIF = {
        chunkNumber: offset + 1,
        totalSize: this.size,
        identifier: this.uniqueIdentifier,
        filename: this.name,
        fileType: this.fileType,
        relativePath: this.relativePath,
        totalChunks: chunkNumber,
      }

      // 文件块对象
      const chunk = new Chunk(this.file, this.uploaderOption, fileParam, offset)
      // 绑定监听事件
      chunk.on('onChunkProgress', this.chunkProgressEvent)
      this.chunks.push(chunk)
    }
  }

  /**
   * 并发上传文件块
   */
  public async concurrentUploadFile() {
    // 创建并发上传对象
    const requestInstance = new ConRequest(this.uploaderOption.simultaneousUploads)
    // 所有的并发请求Promise
    const uploadPromises = []
    // 遍历所有的文件块 得到上传文件块的Promise请求
    this.chunks.forEach((chunk) => {
      const promise = requestInstance.request(chunk)
      uploadPromises.push(promise)

      // 每个文件块的promise回调
      promise
      // 上传成功的处理 错误的处理放在Promise.all中
        .then((response) => {
          // 取消监听事件
          chunk.off('onChunkProgress')
          // 触发文件块上传成功事件
          this.chunkSuccessEvent()
        })
    })

    // 开启所有的上传请求
    await Promise.all(uploadPromises)
  }

  /**
   * 文件块上传中事件 计算当前速度 进度 剩余时间等
   */
  private chunkProgressEvent = () => {
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
    const uploaderFileInfoIF:UploaderFileInfoIF = {
      name: this.name,
      size: this.size,
      uniqueIdentifier: this.uniqueIdentifier,
      currentProgress: this.currentProgress,
      currentSpeed: this.currentSpeed,
      timeRemaining: this.timeRemaining,
    }

    // 触发文件上传中事件 并将uploadFileInfo信息返回
    // 注：不能将整个UploadFile对象返回 否则会导致响应式很慢甚至丢失！
    this.trigger('onFileProgress', uploaderFileInfoIF)

    // 判断是否全部完成
    if (this.isCompleted()) {
      this.isAllComplete = true

      // 取消监听事件
      this.off('onFileProgress')
      this.off('onFileAdd')
      return
    }
  }

  /**
   * 计算已上传文件的大小
   * @returns 已上传文件大小
   */
  private sizeUploaded():number {
    let size = 0

    // 遍历所有文件块 计算已上传文件的大小
    this.chunks.forEach((chunk:Chunk) => {
      size += chunk.sizeUploaded()
    })

    return size
  }

  /**
   * 判断文件是否上传完成
   * @returns 是否全部完成
   */
  private isCompleted():boolean {
    // 遍历所有文件块 判断是否都上传完成
    return this.chunks.every(chunk =>
      chunk.status === STATUS.SUCCESS
    )
  }

  /**
   * 获取文件上传进度
   * @returns 当前文件上传进度
   */
  private uploadFileProgress():number {
    let fileProgress:number = 0

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
  private measureSpeed():number {
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

  /**
   * 暂停文件上传
   */
  private abort() {

  }

  /**
   * 恢复文件上传
   */
  private resume() {

  }

  /**
   * 暂停文件上传
   */
  private pause() {

  }

  /**
   * 取消文件上传
   */
  public cancel() {

  }

  /**
   * 重新上传
   */
  private retry() {

  }
}

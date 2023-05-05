import { Chunk, STATUS } from './chunk'
import { formatMillisecond } from '../utils'
import { MyEvent } from './myEvent'
import { FileParamIF, UploaderOptionsIF } from '../types'

export class UploadFile extends MyEvent {
  // 下载器配置项
  private readonly uploaderOption:UploaderOptionsIF
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
  private uploadChunkNumber:number

  // 是否暂停
  private isPaused:boolean
  // 是否错误
  private isError:boolean
  // 是否上传完成
  private isAllComplated:boolean
  // 是否中断
  private isAborted:boolean
  // 当前下载速度 单位kb/s
  private currentSpeed:number
  // 当前进度 单位 %
  private currentProgress:number
  // 剩余时间 单位 s
  private timeRemaining:number
  // 文件唯一标识
  public uniqueIdentifier:string
  // 上传的开始时间
  private startTime:number

  constructor(file:File, uploaderOption:UploaderOptionsIF) {
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
    this.isAllComplated = false
    this.isAborted = false

    this.currentSpeed = 0
    this.currentProgress = 0
    this.timeRemaining = 0

    this.uploadChunkNumber = 0
    this.uniqueIdentifier = ''
    this.startTime = Date.now()
  }

  /**
   * 对文件切片 生成文件块
   */
  public generateChunks() {
    // 文件块个数
    const chunks = Math.max(Math.ceil(this.size / this.uploaderOption.chunkSize), 1)

    // 生成所有的文件块
    for (let offset = 0; offset < chunks; offset++) {
      // 文件参数信息
      const fileParam:FileParamIF = {
        chunkNumber: offset + 1,
        totalSize: this.size,
        identifier: this.uniqueIdentifier,
        filename: this.name,
        fileType: this.fileType,
        relativePath: this.relativePath,
        totalChunks: chunks,
      }

      // 生成文件块
      const chunk = new Chunk(this.file, this.uploaderOption, fileParam, offset)
      // 绑定监听事件
      chunk.on('onChunkProgress', this.chunkProgressEvent)
      chunk.on('onChunkSuccess', this.chunkSuccessEvent)
      chunk.on('onChunkUploadNext', this.chunkUploadNextEvent)
      chunk.on('onChunkError', this.chunkErrorEvent)
      this.chunks.push(chunk)
    }
  }

  /**
   * 文件块上传中事件
   */
  private chunkProgressEvent = () => {
    this.currentSpeed = this.measureSpeed()
    this.currentProgress = this.uploadFileProgress()
    this.timeRemaining = this.calTimeRemaining()
    console.log('当前速度:', this.currentSpeed + ' kb/s')
    console.log('当前进度:', this.currentProgress + ' %')
    console.log('当前剩余时间:', this.timeRemaining + ' s')
  }

  /**
   * 文件块上传成功事件
   */
  private chunkSuccessEvent = () => {
    // TODO 取消当前文件块的绑定事件
    if (this.isCompleted()) {
      console.log('当前文件已上传完成')
      console.log('一共用时: ', formatMillisecond(Date.now() - this.startTime))
      this.isAllComplated = true
      this.trigger('onFileSuccess', this)
      return
    }

    this.uploadChunkNumber++
    this.uploadNextChunk()
  }

  /**
   * 文件块上传错误事件
   */
  private chunkErrorEvent = () => {
    this.isError = true
    this.trigger('fileError')
  }

  /**
   * 下载下一个文件块事件
   */
  private chunkUploadNextEvent = () => {
    this.uploadNextChunk()
  }

  /**
   * 上传下一个文件块 找到未上传成功的文件块并上传
   */
  public uploadNextChunk() {
    if (this.uploadChunkNumber === 0) {
      this.startTime = Date.now()
    }

    if (this.isError) {
      console.log('当前文件上传错误')
      return
    }

    // 不超过最大支持上传的文件块个数
    if (this.uploadChunkNumber > this.uploaderOption.simultaneousUploads) {
      return
    }

    this.chunks.forEach((chunk) => {
      if (chunk.status === STATUS.PENDING) {
        chunk.preprocess()
        return
      }
    })
  }

  /**
   * 计算已上传文件的大小
   * @returns 已上传文件大小
   */
  private sizeUploaded():number {
    let size = 0

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
    return this.chunks.every((chunk) => {
      return chunk.status === STATUS.SUCCESS
    })
  }

  /**
   * 判断文件是否正在上传
   * @returns 是否有文件块正在上传
   */
  private isUploading():boolean {
    return this.chunks.some((Chunk) => {
      return Chunk.status === STATUS.PROGRESS
    })
  }

  /**
   * 获取文件上传进度
   * @returns 当前文件上传进度
   */
  private uploadFileProgress():number {
    let fileProgress:number = 0

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
    return Math.round(((this.size - this.sizeUploaded()) / this.measureSpeed()) / 1000)
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
    // 如果没有出错 并且没有暂停
    if (!this.isError && !this.isPaused) {
      this.isPaused = true
      this.chunks.forEach((chunk) => {
        if (chunk.status !== STATUS.SUCCESS) {
          chunk.abort()
        }
      })
    }
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

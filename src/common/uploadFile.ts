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

  private isPaused:boolean
  private isError:boolean
  private allError:boolean
  private isAborted:boolean

  private currentSpeed:number
  private currentProgress:number
  private timeRemaining:number

  private lastProgressCallback:number
  private prevUploadedSize:number
  private prevProgress:number
  public uniqueIdentifier:string

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
    this.allError = false
    this.isAborted = false

    this.currentSpeed = 0
    this.currentProgress = 0
    this.timeRemaining = 0

    this.lastProgressCallback = Date.now()
    this.prevUploadedSize = 0
    this.prevProgress = 0
    this.uploadChunkNumber = 0
    this.startTime = Date.now()
  }

  /**
   * 对文件切片 生成文件块
   */
  public generateChunks() {
    const chunks = Math.max(Math.ceil(this.size / this.uploaderOption.chunkSize), 1)
    for (let offset = 0; offset < chunks; offset++) {
      const fileParam:FileParamIF = {
        chunkNumber: offset + 1,
        totalSize: this.size,
        identifier: this.uniqueIdentifier,
        filename: this.name,
        fileType: this.fileType,
        relativePath: this.relativePath,
        totalChunks: chunks,
      }

      const chunk = new Chunk(this.file, this.uploaderOption, fileParam, offset)
      chunk.on('onChunkProgress', this.chunkProgressEvent)
      chunk.on('onChunkSuccess', this.chunkSuccessEvent)
      chunk.on('onChunkUploadNext', this.chunkUploadNextEvent)
      chunk.on('onChunkError', this.chunkErrorEvent)
      this.chunks.push(chunk)
    }
  }

  private chunkProgressEvent = () => {
    this.currentSpeed = this.measureSpeed()
    this.currentProgress = this.uploadFileProgress()
    this.timeRemaining = this.calTimeRemaining()
    console.log('当前速度:', this.currentSpeed + ' kb/s')
    console.log('当前进度:', this.currentProgress + ' %')
    console.log('当前剩余时间:', this.timeRemaining + ' s')
  }

  private chunkSuccessEvent = () => {
    this.uploadChunkNumber++
    this.uploadNextChunk()
  }

  private chunkErrorEvent = () => {
    this.isError = true
    this.trigger('fileError')
  }

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

    if (this.isCompleted()) {
      console.log('当前文件已上传完成')
      console.log('一共用时: ', formatMillisecond(Date.now() - this.startTime))
      this.trigger('onFileSuccess', this)
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
   * 暂停文件上传
   * @private
   */
  private abort() {

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
  isUploading():boolean {
    return this.chunks.some((Chunk) => {
      return Chunk.status === STATUS.PROGRESS
    })
  }

  /**
   * 恢复文件上传
   */
  resume() {
    // 如果没有出错 并且已经暂停
    if (!this.isError && this.isPaused) {
      this.isPaused = false
      this.chunks.forEach((chunk) => {
        if (chunk.status !== STATUS.SUCCESS) {
          chunk.resume()
        }
      })
    }
  }

  /**
   * 暂停文件上传
   */
  pause() {
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
  retry() {
    // 如果没有出错 并且已经暂停
    if (!this.isError) {
      this.chunks.forEach((chunk) => {
        if (chunk.status !== STATUS.SUCCESS) {
          chunk.retry()
        }
      })
    }
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
}

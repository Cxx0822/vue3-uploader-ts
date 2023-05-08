import { Chunk, STATUS } from './chunk'
import { MyEvent } from './myEvent'
import { FileParamIF, UploaderDefaultOptionsIF } from '../types'
import axios from 'axios'

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
  // 总时间
  public totalTime:number

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
    this.totalTime = 0
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

      // TODO 使用生成器生成对象
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

  private InitAxiosRequestConfig() {
    // 添加请求拦截器
    axios.interceptors.request.use((config) => {
      // 请求头数据
      Object.entries(this.uploaderOption.headers).forEach(([k, v]) => {
        config.headers[k] = v
      })

      return config
    }, (error) => {
      // 对请求错误做些什么
      return Promise.reject(error)
    })
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
  private chunkSuccessEvent = (chunk:Chunk) => {
    // 计算总时间
    this.totalTime += chunk.totalTime
    // 判断是否全部完成
    if (this.isCompleted()) {
      console.log('当前文件已上传完成')
      this.isAllComplete = true
      // 触发文件上传成功事件
      this.trigger('onFileSuccess', this)

      // 取消监听事件
      this.off('onFileProgress')
      this.off('onFileSuccess')
      this.off('onFileAdd')
      return
    }

    // this.uploadChunkNumber++
    // 没有上传成功 则继续上传文件块
    this.trigger('onFileProgress', this)
    this.uploadNextChunk()
  }

  /**
   * 文件块上传错误事件
   */
  private chunkErrorEvent = () => {
    this.isError = true
    // 触发文件上传失败事件
    this.trigger('fileError')
  }

  /**
   * 上传下一个文件块事件
   */
  private chunkUploadNextEvent = () => {
    this.uploadNextChunk()
  }

  /**
   * 上传下一个文件块 找到未上传成功的文件块并上传
   */
  public uploadNextChunk() {
    if (this.isError) {
      console.log('当前文件上传错误')
      return
    }

    // 不超过最大支持上传的文件块个数
    if (this.uploadChunkNumber > this.uploaderOption.simultaneousUploads) {
      return
    }

    for (const chunk of this.chunks) {
      // 如果有文件块未上传
      if (chunk.status === STATUS.PENDING) {
        chunk.processUpload()
        return
      }
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

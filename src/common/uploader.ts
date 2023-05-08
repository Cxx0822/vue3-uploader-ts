import { UploadFile } from './uploadFile'

import { UploaderUserOptionsIF, UploaderDefaultOptionsIF } from '../types'
import { MyEvent } from './myEvent'
/**
 * 上传器类
 */
export class Uploader extends MyEvent {
  // 上传文件列表
  public uploadFileList:UploadFile[]
  // 上传器配置项
  public opts:UploaderDefaultOptionsIF

  constructor(options:UploaderUserOptionsIF) {
    super()
    // 合并默认值配置和自定义配置
    this.opts = Object.assign(optionsDefaults, options)
    this.eventData = {}
    this.uploadFileList = []
  }

  /**
   * 增加上传文件
   * @param fileList 文件列表
   */
  addFiles(fileList:FileList) {
    Array.from(fileList).forEach((file:File) => {
      // 判断文件大小
      if (file.size > 0) {
        // 获取文件的唯一标识
        const uniqueIdentifier = this.generateUniqueIdentifier(file)

        // 如果该文件未上传 则添加至上传文件列表中
        if (this.IsUniqueIdentifier(uniqueIdentifier)) {
          // 生成UploadFile对象
          const uploadFile = new UploadFile(file, this.opts)
          uploadFile.uniqueIdentifier = uniqueIdentifier
          // 绑定监听事件
          uploadFile.on('onFileProgress', this.fileProgressEvent)
          uploadFile.on('onFileSuccess', this.fileSuccessEvent)
          uploadFile.on('fileError', this.fileErrorEvent)
          this.uploadFileList.push(uploadFile)
          this.trigger('onFileAdd', uploadFile)

          // 如果需要自动上传
          if (this.opts.autoStart) {
            uploadFile.generateChunks()
            // uploadFile.uploadNextChunk()
            uploadFile.concurrentUploadFile()
          }
        }
      }
    })
  }

  /**
   * 上传中事件
   */
  private fileProgressEvent = (uploadFile: UploadFile) => {
    // 找到正在处理的文件
    const index = this.uploadFileList.findIndex((item) => {
      return item.uniqueIdentifier === uploadFile.uniqueIdentifier
    })

    // 更新该文件状态
    this.uploadFileList[index] = uploadFile

    // 触发上传器上传中事件
    this.trigger('onUploaderProgress', this.uploadFileList[index])
  }

  /**
   * 上传成功事件
   * @param uploadFile 上传文件
   */
  private fileSuccessEvent = (uploadFile:UploadFile) => {
    // 触发上传器上传成功事件
    this.trigger('onFileSuccess', uploadFile)
  }

  /**
   * 上传失败事件
   */
  private fileErrorEvent = () => {
    // 触发上传器上传失败事件
    this.trigger('onFileFailed')
  }

  /**
   * 获取文件的唯一标识
   * @param file 文件
   * @returns 文件的唯一标识
   */
  generateUniqueIdentifier(file:File):string {
    // 如果有自定义的获取文件唯一标识方法
    const custom = this.opts.generateUniqueIdentifier
    if (typeof custom === 'function') {
      return custom(file)
    }

    // 默认的文件唯一标识为 文件大小+文件名
    const relativePath = file.webkitRelativePath || file.name
    return file.size + '-' + relativePath
  }

  /**
   * 判断文件是否在上传文件列表中
   * @param uniqueIdentifier 文件唯一标识
   * @returns 是否在上传文件列表中
   */
  IsUniqueIdentifier(uniqueIdentifier:string):boolean {
    // 防止多次上传同一个文件
    // 如果每个文件的标识都不等于该标识 则认为该文件不在上传列表中
    return this.uploadFileList.every((uploadFile) => {
      return uploadFile.uniqueIdentifier !== uniqueIdentifier
    })
  }

  /**
   * 取消文件上传
   */
  cancelFile() {

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

    if (!this.opts.singleFile && !singleFile) {
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
  chunkSize: 1 * 1024 * 1024,
  simultaneousUploads: 3,
  singleFile: false,
  fileParameterName: 'file',
  headers: {},
  targetUrl: '/',
  uploadFolderPath: '/',
  maxChunkRetries: 0,
  successCode: [20000],
  autoStart: true,
}

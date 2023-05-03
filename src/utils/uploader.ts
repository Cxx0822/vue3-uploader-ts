import { UploadFile } from './file'
import { STATUS } from './chunk'

interface eventData {
  [key: string]: Function
}

export class Uploader {
  // 事件集合
  private eventData:eventData
  // 下载文件列表
  private uploadFileList:UploadFile[]
  // 下载文件块个数
  private uploadChunkNum:number
  public opts

  constructor() {
    this.eventData = {}
    this.uploadChunkNum = 0
    this.opts = optionsDefaults
  }

  // 注册事件
  on(name:string, func:Function) {
    // 判断是否已经注册过
    if (!Object.keys(this.eventData).includes(name)) {
      // 没有注册过 则添加事件
      this.eventData[name] = func
    }
  }

  // 删除事件
  off(name:string, func:Function) {
    // 判断是否已经注册过
    if (Object.keys(this.eventData).includes(name)) {
      // 已经注册过 则删除事件
      delete this.eventData[name]
    }
  }

  // 触发事件
  trigger(name:string, ...ags:any) {
    // 判断是否已经注册过
    if (Object.keys(this.eventData).includes(name)) {
      // 已经注册过 触发事件
      this.eventData[name](ags)
    }
  }

  // _trigger(name:string, event?:Event) {
  //   const args = utils.toArray(arguments)
  //   let preventDefault = !this.trigger.apply(this, arguments)
  //   if (name !== 'catchAll') {
  //     args.unshift('catchAll')
  //     preventDefault = !this.trigger.apply(this, args) || preventDefault
  //   }
  //   return !preventDefault
  // }

  // _triggerAsync() {
  //   const args = arguments
  //   utils.nextTick(() => {
  //     this._trigger(args)
  //   }, this)
  // }

  addFiles(fileList:FileList | null, evt:Event) {
    if (fileList === null) {
      return
    }

    Array.from(fileList).forEach((file:File) => {
      // 文件大小＞0
      if (file.size > 0) {
        // 获取文件的唯一标识
        const uniqueIdentifier = this.generateUniqueIdentifier(file)

        // allowDuplicateUploads: 允许重复上传
        if (this.opts.allowDuplicateUploads || !this.getFromUniqueIdentifier(uniqueIdentifier)) {
          const uploadFile = new UploadFile(this, file)
          uploadFile.uniqueIdentifier = uniqueIdentifier
          this.uploadFileList.push(uploadFile)
        }
      }
    })
  }

  /**
   * 获取文件的唯一标识
   * @param file 文件
   * @returns 文件的唯一标识
   */
  generateUniqueIdentifier(file:File):string {
    const custom = this.opts.generateUniqueIdentifier
    if (typeof custom === 'function') {
      return custom(file)
    }
    /* istanbul ignore next */
    // Some confusion in different versions of Firefox
    const relativePath = file.webkitRelativePath || file.name
    /* istanbul ignore next */
    return file.size + '-' + relativePath.replace(/[^0-9a-zA-Z_-]/img, '')
  }

  /**
   * 判断文件是否在上传文件列表中
   * @param uniqueIdentifier 文件标识
   * @returns 是否在上传文件列表中
   */
  getFromUniqueIdentifier(uniqueIdentifier:string) {
    return this.uploadFileList.every((uploadFile) => {
      return uploadFile.uniqueIdentifier === uniqueIdentifier
    })
  }

  cancel() {
    for (let i = this.uploadFileList.length - 1; i >= 0; i--) {
      this.uploadFileList[i].cancel()
    }
  }

  removeFile(file:UploadFile) {
    // File.prototype.removeFile.call(this, file)
    // this._trigger('fileRemoved', file)
  }

  uploadNextChunk() {
    // 最大下载文件块
    if (this.uploadChunkNum > this.opts.simultaneousUploads) {
      return
    }

    let isAllComplete = true
    // 下载下一个文件块
    this.uploadFileList.forEach((uploadFile) => {
      if (!uploadFile.isComplete) {
        isAllComplete = false
        uploadFile.chunks.forEach((chunk) => {
          if (chunk.status === STATUS.PENDING) {
            chunk.sendData()
          }
        })
      }
    })

    if (isAllComplete) {
      console.log('所有文件上传完成')
    }
  }

  /**
   * Assign a browse action to one or more DOM nodes.
   * @function
   * @param {Element|Array.<Element>} domNodes
   * @param {boolean} isDirectory Pass in true to allow directories to
   * @param {boolean} singleFile prevent multi file upload
   * @param {Object} attributes set custom attributes:
   *  http://www.w3.org/TR/html-markup/input.file.html#input.file-attributes
   *  eg: accept: 'image/*'
   * be selected (Chrome only).
   */
  assignBrowse(domNodes:HTMLElement | HTMLElement[],
    isDirectory:boolean,
    singleFile:boolean) {
    if (!Array.isArray(domNodes)) {
      domNodes = [domNodes]
    }

    domNodes.forEach((domNode:HTMLElement) => {
      let input:HTMLElement

      // 如果是Input类型
      if (domNode.tagName === 'INPUT') {
        input = domNode
      } else {
        // 如果不是input类型 则创建input元素
        input = document.createElement('input')
        input.setAttribute('type', 'file')
        input.style.visibility = 'hidden'
        input.style.position = 'absolute'
        input.style.width = '1px'
        input.style.height = '1px'

        // for opera 12 browser, input must be assigned to a document
        domNode.appendChild(input)
        // https://developer.mozilla.org/en/using_files_from_web_applications)
        // event listener is executed two times
        // first one - original mouse click event
        // second - input.click(), input is inside domNode
        domNode.addEventListener('click', (event:Event) => {
          if (domNode.tagName.toLowerCase() === 'label') {
            return
          }
          input.click()
        }, false)
      }
      if (!this.opts.singleFile && !singleFile) {
        input.setAttribute('multiple', 'multiple')
      }

      if (isDirectory) {
        input.setAttribute('webkitdirectory', 'webkitdirectory')
      }

      // attributes && utils.each(attributes, function(value, key) {
      //   input.setAttribute(key, value)
      // })

      // When new files are added, simply append them to the overall list
      input.addEventListener('change', (event:Event) => {
        // this._trigger(event.type, event)

        if (event.target !== null) {
          const inputElement = event.target as HTMLInputElement

          if (inputElement.value) {
            this.addFiles(inputElement.files, event)
            inputElement.value = ''
          }
        }
      }, false)
    })
  }
}

const optionsDefaults = {
  chunkSize: 1 * 1024 * 1024,
  forceChunkSize: false,
  simultaneousUploads: 3,
  singleFile: false,
  fileParameterName: 'file',
  progressCallbacksInterval: 500,
  speedSmoothingFactor: 0.1,
  query: {},
  headers: {},
  withCredentials: false,
  preprocess: () => {},
  method: 'multipart',
  testMethod: 'GET',
  uploadMethod: 'POST',
  prioritizeFirstAndLastChunk: false,
  allowDuplicateUploads: false,
  target: '/',
  testChunks: true,
  generateUniqueIdentifier: (file:File) => {},
  maxChunkRetries: 0,
  chunkRetryInterval: null,
  permanentErrors: [404, 415, 500, 501],
  successStatuses: [200, 201, 202],
  onDropStopPropagation: false,
  initFileFn: null,
  checkChunkUploadedByResponse: null,
  initialPaused: false
}

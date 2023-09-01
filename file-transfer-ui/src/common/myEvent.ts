import { IEventData, IUploaderFileInfo } from '@/types'
import { UploadFile } from './uploadFile'
import { Chunk } from './chunk'

export class MyEvent {
  // 事件集合
  protected eventData: IEventData

  constructor() {
    this.eventData = {}
  }

  // 注册事件
  on(name: string, event: Function) {
    // 判断是否已经注册过
    if (!Object.keys(this.eventData).includes(name)) {
      // 没有注册过 则添加事件
      this.eventData[name] = event
    }
  }

  // 删除事件
  off(name: string) {
    // 判断是否已经注册过
    if (Object.keys(this.eventData).includes(name)) {
      // 已经注册过 则删除事件
      delete this.eventData[name]
    }
  }

  // 触发事件
  trigger(name: string, data?: UploadFile | Chunk | IUploaderFileInfo | string) {
    // 判断是否已经注册过
    if (Object.keys(this.eventData).includes(name)) {
      // 已经注册过 触发事件
      this.eventData[name](data)
    }
  }
}

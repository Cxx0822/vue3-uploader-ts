import { Chunk } from './chunk'

/**
 * 并发请求类
 */
export class ConRequest {
    // 最大并发请求数量
    private readonly maxLimit:number = 3
    // 请求队列
    private requestQueue:Function[] = []
    // 当前请求数量
    private currentConRequestNumber:number
    // 是否暂停
    private isPause:boolean = false

    constructor(maxLimit:number) {
      this.maxLimit = maxLimit
      this.currentConRequestNumber = 0
    }

    /**
     * 网络请求
     * @param chunk 文件块
     */
    async request(chunk:Chunk) {
      // 如果当前请求数大于最大并发请求数 则等待
      if (this.currentConRequestNumber >= this.maxLimit) {
        await this.waitRequesting()
      }

      try {
        // 当前并发数量递增
        this.currentConRequestNumber++
        // 文件块业务 需要记录文件上传的开始时间
        chunk.startTime = Date.now()
        // 上传文件块数据
        const result = await chunk.uploadChunkData()

        // console.log('当前并发数:', this.currentConRequestNumber)
        // 如果需要暂停
        if (this.isPause) {
          await this.waitRequesting()
        } else {
          // 当前并发数量递减
          this.currentConRequestNumber--
          // 执行下一条请求
          this.nextRequesting()
        }

        // 返回正确的Promise
        return Promise.resolve(result)
      } catch (error) {
        // 返回错误的Promise
        return Promise.reject(error)
      } finally {
        // // console.log('当前并发数:', this.currentConRequestNumber)
        // // 当前并发数量递减
        // this.currentConRequestNumber--
        // // 执行下一条请求
        // this.nextRequesting()
      }
    }

    /**
     * 等待请求
     */
    waitRequesting() {
      let _resolve:Function = () => {}
      // 创建一个空Promise 并拿到该resolve函数
      // 只要该Promise没有被resolve或者reject 就会一直处在Pending中
      // 相当于Promise被暂停在此处
      const promise = new Promise((resolve:Function) => { _resolve = resolve })
      this.requestQueue.push(_resolve)
      return promise
    }

    /**
     * 执行下一个请求
     */
    nextRequesting() {
      if (this.requestQueue.length <= 0) return
      // 从队列中拿到之前Promise的resolve函数 并执行 从而释放之前的Promise
      const resolve = this.requestQueue.shift() as Function
      resolve()
    }

    pauseRequesting() {
      this.isPause = true
    }

    resumeRequesting() {
      this.isPause = false
      // 执行下一条请求
      this.nextRequesting()
    }
}

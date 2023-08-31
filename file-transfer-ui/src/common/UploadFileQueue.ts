export class UploadFileQueue<T> {
  item: T[]
  constructor() {
    this.item = []
  }

  /**
   * 入列
   * @param value 元素
   */
  insertQueue(value: T) {
    this.item.push(value)
  }
  /**
   * 出列
   */
  deleteQueue() {
    return this.item.shift()
  }
  /**
   * 返回队首
   */
  peek() {
    return this.item[0]
  }

  /**
   * 返回队尾
   */
  tail() {
    return this.item[this.item.length - 1]
  }
  /**
   * 返回整个队列
   */
  getAll() {
    return this.item
  }
  /**
   * 判断队列是否为空
   */
  isEmpty() {
    return this.item.length === 0
  }

  /**
   * 返回队列长度
   */
  size() {
    return this.item.length
  }

  /**
   * 格式化方法
   */
  toString() {
    let res = ''
    for (let i = 0; i < this.item.length; i++) {
      res += `${this.item[i]} `
    }
    return res
  }
}

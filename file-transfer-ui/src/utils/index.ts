import { faImage, faFilePdf, faFile } from '@fortawesome/free-solid-svg-icons'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import * as SparkMD5 from 'spark-md5'

/**
 * 获取文件图标
 * @param fileName 文件名
 */
export const getFileTypeIcon = (fileName: string) => {
  // 获取文件后缀名
  const reg = /\.[^.]+$/
  const fileType = reg.exec(fileName)?.[0].toLowerCase().slice(1)

  let fileTypeIcon: IconDefinition
  // 自定义新增文件类型
  switch (fileType) {
    case 'img':
      fileTypeIcon = faImage
      break
    case 'pdf':
      fileTypeIcon = faFilePdf
      break
    default:
      fileTypeIcon = faFile
      break
  }
  return fileTypeIcon
}

/**
 * 格式化秒 小时:分钟:秒
 @param {number} second 传入的需要转换的并且时间单位为秒的值
 @param {boolean} [roundSecond=false] 是否对秒数进行四舍五入
 @returns {string} 返回的格式化后的时间字符串
 */
export const formatMillisecond = (
  second: number,
  roundSecond = false
) => {
  const hours = Math.floor(second / 3600)
  const minutes = Math.floor((second - hours * 3600) / 60)
  let seconds = second - hours * 3600 - minutes * 60

  if (roundSecond) {
    seconds = Math.round(seconds)
  }

  return `${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`
}

/**
 * 格式化时/分/秒 2位显示
 * @param time 时/分/秒
 */
const formatTime = (time: number) => {
  let timeStr = time.toFixed(0)
  if (Number(timeStr) <= 9) {
    timeStr = `0${timeStr}`
  }

  return timeStr
}

/**
 * 格式化文件大小 自适应调整为B KB MB GB等
 * @param size 文件大小 单位B
 * @param digits 保留的小数 默认为2位
 */
export const formatFileSize = (size: number, digits = 2) => {
  if (size < 1024) {
    return `${size}B`
  } else if (size >= 1024 && size < Math.pow(1024, 2)) {
    return `${parseFloat((size / 1024).toString()).toFixed(digits)}KB`
  } else if (size >= Math.pow(1024, 2) && size < Math.pow(1024, 3)) {
    return `${parseFloat((size / Math.pow(1024, 2)).toString()).toFixed(digits)}MB`
  } else if (size > Math.pow(1024, 3)) {
    return `${parseFloat((size / Math.pow(1024, 3)).toString()).toFixed(digits)}GB`
  } else {
    return `${0}B`
  }
}

/**
 * 格式化传输速度
 * @param speed 传输速度 kb/s
 * @param digits 保留的小数 默认为2位
 */
export const formatSpeed = (speed: number, digits = 2) => {
  if (speed < 1024) {
    return `${speed}Kb/s`
  } else if (speed >= 1024 && speed < Math.pow(1024, 2)) {
    return `${parseFloat((speed / 1024).toString()).toFixed(digits)}Mb/s`
  } else if (speed >= Math.pow(1024, 2) && speed < Math.pow(1024, 3)) {
    return `${parseFloat((speed / Math.pow(1024, 2)).toString()).toFixed(digits)}Gb/s`
  } else {
    return `${0}B`
  }
}

/**
 * 获取文件的唯一标识
 * @param file 文件
 * @param chunkSize 文件大小
 * @returns 文件的唯一标识
 */
export const generateUniqueIdentifier = async (file: File, chunkSize: number) => {
  // 采用MD5算法生成校验字符串
  let spark = new SparkMD5.ArrayBuffer()
  const chunkCount = Math.ceil(file.size / chunkSize)

  // 如果传入的是大文件 则MD5计算时间较长
  // 因此采用第1个文件块和最后一个文件块的方式组合计算MD5 确保文件唯一
  // TODO 采用此方法大文件计算MD5还是比较慢 需要优化
  const chunkBytes = file.slice(0, Math.min(chunkSize, file.size))
  spark = await getFileSparkMD5(spark, chunkBytes)
  // 如果有超过2个文件块
  if (chunkCount > 1) {
    const endByte = Math.min(chunkSize * (chunkCount - 1), file.size)
    spark = await getFileSparkMD5(spark, file.slice(chunkSize, endByte))
  }

  // 返回计算的值
  return spark.end()
}

/**
 * 获取文件块的MD5校验值
 * @param spark SparkMD5实例
 * @param chunkBytes 文件块字节
 */
const getFileSparkMD5 = (spark: SparkMD5.ArrayBuffer, chunkBytes: Blob) => {
  return new Promise<SparkMD5.ArrayBuffer>((resolve, reject) => {
    const fileReader = new FileReader()
    fileReader.readAsArrayBuffer(chunkBytes)

    // 加载文件
    fileReader.onload = (event: ProgressEvent) => {
      // 增加MD5信息
      spark.append((event.target as any).result)
      resolve(spark)
    }

    // 加载文件
    fileReader.onerror = () => {
      reject(new Error('读取文件失败'))
    }
  })
}

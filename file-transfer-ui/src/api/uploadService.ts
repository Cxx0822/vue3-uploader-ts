import request from '@/utils/request'
import { UploadFile } from '@/common/uploadFile.ts'

interface IAxiosResult {
  success: boolean;
  code: number;
  message: string;
  data: {
    [key: string]: any;
  };
}

/**
 * 上传文件块
 * @param url 服务器路径
 * @param identifier 文件唯一标识
 * @param filename 文件名
 * @param uploadFolderPath 上传文件路径
 */
export const uploadChunk = (url: string,
  identifier: string,
  filename: string,
  uploadFolderPath: string): Promise<IAxiosResult> =>
  request({
    url,
    method: 'get',
    params: { identifier, filename, uploadFolderPath }
  })

/**
 * 删除文件块
 * @param url 服务器路径
 * @param identifier 文件唯一标识
 * @param uploadFolderPath 上传文件路径
 */
export const deleteChunk = (url: string,
  identifier: string,
  uploadFolderPath: string): Promise<IAxiosResult> =>
  request({
    url,
    method: 'delete',
    params: { identifier, uploadFolderPath }
  })

/**
 * 合并上传的文件块
 * @param url 服务器路径
 * @param uploadFile 上传文件
 * @param uploadFolderPath 上传文件路径
 */
export const mergeFile = (url: string,
  uploadFile: UploadFile,
  uploadFolderPath: string): Promise<IAxiosResult> =>
  request({
    url,
    method: 'post',
    data: uploadFile,
    params: { uploadFolderPath },
    responseType: 'blob'
  })

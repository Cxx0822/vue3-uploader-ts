package file.transfer.service.service;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.File;
import java.io.IOException;
import java.util.List;

public interface ChunkService {
    /**
     * 下载文件块
     * @param file 下载文件
     * @param request web请求
     * @param response web响应
     * @throws IOException IO错误
     */
    void downloadChunk(File file, HttpServletRequest request, HttpServletResponse response) throws IOException;

    /**
     * 获取已经上传的文件块列表
     * @param folder 文件夹
     * @param filename 文件名
     * @return 已上传的文件块列表
     */
    List<Integer> getUploadedChunkList(String folder, String filename);

    /**
     * 合并文件
     * @param localFile 本地文件名
     * @param localFolder 本地文件夹
     * @param uploadFilename 上传的文件名
     * @return 是否合并成功
     */
    boolean mergeFile(String localFile, String localFolder, String uploadFilename);
}

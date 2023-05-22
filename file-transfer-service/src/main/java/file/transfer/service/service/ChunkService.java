package file.transfer.service.service;

public interface ChunkService {
    /**
     * 获取下载的文件块
     * @param downloadFileName 下载的文件名
     * @param chunkSize 分块大小
     * @param offset 偏移量
     * @return 文件块
     */
    byte[] getDownloadChunk(String downloadFileName, Integer chunkSize, long offset);
}

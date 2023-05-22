package file.transfer.service.service.impl;

import file.transfer.service.service.ChunkService;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.RandomAccessFile;

@Service
public class ChunkServiceImpl implements ChunkService {
    /**
     * 获取下载的文件块
     * @param downloadFileName 下载的文件名
     * @param chunkSize 分块大小
     * @param offset 偏移量
     * @return 文件块
     */
    @Override
    public byte[] getDownloadChunk(String downloadFileName, Integer chunkSize,long offset) {

        try (RandomAccessFile randomAccessFile = new RandomAccessFile(downloadFileName, "r")) {
            // 定位到该分片的偏移量
            randomAccessFile.seek(offset);
            // 读取分块文件
            byte[] buffer = new byte[chunkSize];
            randomAccessFile.read(buffer);

            return buffer;
        } catch (IOException e) {
            e.printStackTrace();
            return null;
        }
    }
}

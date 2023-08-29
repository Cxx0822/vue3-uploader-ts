package file.transfer.service.service.impl;

import file.transfer.service.service.ChunkService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static file.transfer.service.utils.FileUtil.fileExists;

/**
 * @author Cxx
 */
@Service
@Slf4j
public class ChunkServiceImpl implements ChunkService {
    private final String fileSeparator = "_";

    /**
     * 下载文件块
     *
     * @param file     下载文件
     * @param request  web请求
     * @param response web响应
     * @throws IOException IO错误
     */
    @Override
    public void downloadChunk(File file, HttpServletRequest request, HttpServletResponse response) throws IOException {
        InputStream inputStream = null;
        OutputStream outputStream = null;
        try {
            // 分片下载
            long fileSize = file.length();
            // 定义断点
            long startPosition, endPosition;
            // 文件输入流
            inputStream = new BufferedInputStream(new FileInputStream(file));
            // response输出流
            outputStream = new BufferedOutputStream(response.getOutputStream());

            // 设置有用户决定是否需要下载
            response.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);
            // 设置文件类型
            response.setContentType("application/x-download");
            // 设置以附件的形式下载并保存到本地
            response.addHeader("Content-Disposition", "attachment;filename=" +
                    URLEncoder.encode(file.getName(), StandardCharsets.UTF_8));
            // 设置可以中断下载
            response.setHeader("Accept-Range", "bytes");
            // 设置文件的大小 Bug:这里如果设置了Content-Length 则后端会卡死
            // response.setHeader("Content-Length", "" + fileSize);

            // 获取前端的文件块范围
            String chunkRange = request.getHeader("Range").replaceAll("bytes=", "");
            String[] chunkRangeArray = chunkRange.split("-");

            // 获取文件块的起始位置
            startPosition = Long.parseLong(chunkRangeArray[0]);
            endPosition = Long.parseLong(chunkRangeArray[1]);
            // 若结束字节超出文件大小 取文件大小
            if (endPosition > fileSize - 1) {
                endPosition = fileSize - 1;
            }

            // 跳过之前下载的位置
            long skip = inputStream.skip(startPosition);
            // buffer缓冲区
            byte[] buffer = new byte[1024];
            // 需要读取的文件块大小
            long chunkTotalLength = endPosition - startPosition + 1;
            // 当前读取的总大小 和 读取到Buffer的长度
            int currentTotalLength = 0, readBufferLength = 0;
            // 循环读取文件并写入到response中
            while (currentTotalLength < chunkTotalLength) {
                // 需要读取的buffer长度
                int readLength = (chunkTotalLength - currentTotalLength) <= buffer.length
                        ? (int) (chunkTotalLength - currentTotalLength)
                        : buffer.length;
                // 从输入流中读取指定长度到Buffer中
                readBufferLength = inputStream.read(buffer, 0, readLength);
                // 计算当前读取到的总长度
                currentTotalLength = currentTotalLength + readBufferLength;
                // 将Buffer中的数据写入到response输出流中
                outputStream.write(buffer, 0, readBufferLength);
            }
        } finally {
            // 关闭输入 输出流
            if (inputStream != null) {
                inputStream.close();
            }
            if (outputStream != null) {
                outputStream.close();
            }
        }
    }

    /**
     * 获取已经上传的文件块列表
     *
     * @param folder   文件夹
     * @param filename 文件名
     * @return 已上传的文件块列表
     */
    public List<Integer> getUploadedChunkList(String folder, String filename) {
        List<Integer> uploadedChunkList = new ArrayList<>();

        // 获取文件夹下所有的文件
        try (Stream<Path> list = Files.list(Paths.get(folder))) {
            // 去除需要合并的文件
            list.filter(path -> !path.getFileName().toString().equals(filename))
                    // 循环遍历文件 将已经上传的文件序号添加至列表中
                    .forEach(path -> {
                        String chunkPath = path.getFileName().toString();
                        int index = chunkPath.lastIndexOf(fileSeparator);
                        uploadedChunkList.add(Integer.valueOf(chunkPath.substring(index + 1)));
                    });
        } catch (Exception exception) {
            log.error("获取文件块失败: {}", exception.getMessage());
        }

        return uploadedChunkList;
    }

    /**
     * 合并文件
     *
     * @param localFile      本地文件名
     * @param localFolder    本地文件夹
     * @param uploadFilename 上传的文件名
     * @return 是否合并成功
     */
    public boolean mergeFile(String localFile, String localFolder, String uploadFilename) {
        // 判断文件是否存在
        if (fileExists(localFile)) {
            log.info("需要合并的文件{}已经存在", uploadFilename);
            return true;
        }

        try {
            // 不存在的话，进行合并
            Files.createFile(Paths.get(localFile));

            // 获取文件夹下所有的文件
            try (Stream<Path> list = Files.list(Paths.get(localFolder))) {
                // 去除需要合并的文件
                list.filter(path -> !path.getFileName().toString().equals(uploadFilename))
                        // 按照文件名排序
                        .sorted((o1, o2) -> {
                            String p1 = o1.getFileName().toString();
                            String p2 = o2.getFileName().toString();
                            int i1 = p1.lastIndexOf(fileSeparator);
                            int i2 = p2.lastIndexOf(fileSeparator);
                            return Integer.valueOf(p1.substring(i1 + 1))
                                    .compareTo(Integer.valueOf(p2.substring(i2 + 1)));
                        })
                        // 循环写入到文件中
                        .forEach(path -> {
                            try {
                                // 以追加的形式写入文件
                                Files.write(Paths.get(localFile), Files.readAllBytes(path), StandardOpenOption.APPEND);
                                // 合并后删除该块
                                Files.delete(path);
                            } catch (IOException exception) {
                                log.error("写入文件失败: " + exception.getMessage());
                            }
                        });
            }
            return true;
        } catch (IOException exception) {
            log.error("文件合并失败: {}", exception.getMessage());
            return false;
        }
    }
}

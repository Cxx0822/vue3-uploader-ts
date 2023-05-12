package file.transfer.service.utils;

import file.transfer.service.entity.upload.ChunkInfo;
import lombok.extern.slf4j.Slf4j;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.util.stream.Stream;

@Slf4j
public class UploadFileUtil {
    /**
     * 获取文件路径
     * @param uploadFolder 上传文件夹路径
     * @param chunkInfo 分片文件信息
     * @return 文件路径
     */
    public static String generatePath(String uploadFolder, ChunkInfo chunkInfo) {
        String filePath = uploadFolder + File.separator + chunkInfo.getIdentifier();
        Path path = Paths.get(filePath);
        // 判断uploadFolder/identifier 路径是否存在，不存在则创建
        if (!Files.isWritable(path)) {
            log.info("文件路径不存在 创建路径: {}", filePath);
            try {
                Files.createDirectories(path);
            } catch (IOException exception) {
                log.error("创建路径失败: " + exception.getMessage());
            }
        }

        return filePath + File.separator + chunkInfo.getFilename() + "-" + chunkInfo.getChunkNumber();
    }

    /**
     * 文件合并
     */
    public static boolean merge(String file, String folder, String filename) {
        // 判断文件是否存在
        if (fileExists(file)) {
            log.info("需要合并的文件{}已经存在", filename);
            return true;
        }

        try {
            // 不存在的话，进行合并
            Files.createFile(Paths.get(file));

            // 获取文件夹下所有的文件
            try (Stream<Path> list = Files.list(Paths.get(folder))) {
                // 去除需要合并的文件
                list.filter(path -> !path.getFileName().toString().equals(filename))
                        // 按照文件名排序
                        .sorted((o1, o2) -> {
                            String p1 = o1.getFileName().toString();
                            String p2 = o2.getFileName().toString();
                            int i1 = p1.lastIndexOf("-");
                            int i2 = p2.lastIndexOf("-");
                            return Integer.valueOf(p2.substring(i2)).compareTo(Integer.valueOf(p1.substring(i1)));
                        })
                        // 循环写入到文件中
                        .forEach(path -> {
                            try {
                                // 以追加的形式写入文件
                                Files.write(Paths.get(file), Files.readAllBytes(path), StandardOpenOption.APPEND);
                                // 合并后删除该块
                                Files.delete(path);
                            } catch (IOException exception) {
                                log.error("写入文件失败: " + exception.getMessage());
                            }
                        });
            }
            return true;
        } catch (IOException exception) {
            log.error("文件合并失败: " + exception.getMessage());
            return false;
        }
    }

    /**
     * 根据文件的全路径名判断文件是否存在
     */
    public static boolean fileExists(String file) {
        Path path = Paths.get(file);
        return Files.exists(path, LinkOption.NOFOLLOW_LINKS);
    }
}

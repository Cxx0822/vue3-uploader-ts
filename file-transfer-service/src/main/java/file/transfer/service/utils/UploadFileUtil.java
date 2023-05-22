package file.transfer.service.utils;

import file.transfer.service.entity.upload.ChunkInfo;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.http.HttpServletResponse;
import java.io.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

@Slf4j
public class UploadFileUtil {
    private static final String fileSeparator = "_";

    /**
     * 获取文件路径
     *
     * @param uploadFolder 上传文件夹路径
     * @param chunkInfo    分片文件信息
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

        return filePath + File.separator + chunkInfo.getFilename() + fileSeparator + chunkInfo.getChunkNumber();
    }

    public static List<Integer> getUploadedChunkList(String folder, String filename) {
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
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        return uploadedChunkList;
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
                            int i1 = p1.lastIndexOf(fileSeparator);
                            int i2 = p2.lastIndexOf(fileSeparator);
                            return Integer.valueOf(p1.substring(i1 + 1))
                                    .compareTo(Integer.valueOf(p2.substring(i2 + 1)));
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

    /**
     * 删除目录（文件夹）以及目录下的文件
     *
     * @param sPath 被删除目录的文件路径
     * @return 目录删除成功返回true，否则返回false
     */
    public static boolean deleteDirectory(String sPath) {
        // 如果sPath不以文件分隔符结尾，自动添加文件分隔符
        if (!sPath.endsWith(File.separator)) {
            sPath = sPath + File.separator;
        }
        File dirFile = new File(sPath);
        // 如果dir对应的文件不存在，或者不是一个目录，则退出
        if (!dirFile.exists() || !dirFile.isDirectory()) {
            return false;
        }

        boolean flag = true;
        // 删除文件夹下的所有文件(包括子目录)
        File[] files = dirFile.listFiles();
        for (File file : Objects.requireNonNull(files)) {
            // 删除子文件
            if (file.isFile()) {
                flag = deleteFile(file.getAbsolutePath());
            }
            // 删除子目录
            else {
                flag = deleteDirectory(file.getAbsolutePath());
            }
            if (!flag) break;
        }
        if (!flag) return false;

        log.info("文件删除成功");
        // 删除当前目录
        return dirFile.delete();
    }

    /**
     * 删除单个文件
     *
     * @param sPath 被删除文件的文件名
     * @return 单个文件删除成功返回true，否则返回false
     */
    public static boolean deleteFile(String sPath) {
        boolean flag = false;
        File file = new File(sPath);
        // 路径为文件且不为空则进行删除
        if (file.isFile() && file.exists()) {
            flag = file.delete();
        }
        return flag;
    }
}

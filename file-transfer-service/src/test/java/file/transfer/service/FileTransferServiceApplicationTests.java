package file.transfer.service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class FileTransferServiceApplicationTests {

    @Test
    void contextLoads() {
        String fileName = "google-chrome.deb_2";
        String[] split = fileName.split(String.valueOf('_'));
        System.out.println(Integer.valueOf(split[split.length - 1]));
    }

}

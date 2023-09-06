# 项目概述
&emsp;&emsp;本项目主要解决大文件在网络传输(上传和下载)时遇到的以下问题：   
1. 大文件直接上传，系统会占用大量的内存，从而可能导致内存溢出等问题。
2. 如果网络环境不好，可能会导致传输过程中断，且无法继续传输，只能重新传输。
3. 传输过程中无法知道传输进度、传输速度和剩余时间等信息。  

&emsp;&emsp;因此，针对上述问题，本项目根据对大文件进行**分片传输**的原理，实现网络传输的断点续传、秒传和显示传输过程的功能。   

# 项目技术栈
&emsp;&emsp;项目采用Web前后端分离的技术，为了简化开发，暂时不考虑数据库的设计。   
## Web前端
&emsp;&emsp;Web前端框架: Vue 3.2.47   
&emsp;&emsp;Web前端构建工具: Vite 3.1.0  
&emsp;&emsp;网络请求库: Axios 1.4.0   
&emsp;&emsp;开发语言: Typescript 5.0.2  
&emsp;&emsp;开发工具: WebStorm 2023.1.2    
&emsp;&emsp;浏览器: Chrome/Microsoft Edge
## Web后端
&emsp;&emsp;Web后端框架: Spring Boot 2.5.9  
&emsp;&emsp;开发语言: java 11  
&emsp;&emsp;开发工具: IDEA 2023.1.2

# 文件上传模块
## 业务流程
![文件上传业务流程图](./file-transfer-ui/src/assets/readme/文件上传业务流程图.png)    
&emsp;&emsp;首先用户选择需要上传的文件，然后前端将文件信息发送至后端校验，如果已经存在，则通知前端秒传，否则将已经上传好的文件块序号返回至前端，然后前端将文件分片，并将需要上传的文件块发送至后端，最后当前端上传完成时通知后端合并文件。  
### 前端业务  
![文件上传前端业务](./file-transfer-ui/src/assets/readme/文件上传前端业务.png)   

### 文件流程图
![文件上传文件流程图](./file-transfer-ui/src/assets/readme/文件上传文件流程图.png)        

## 技术实现
### 文件唯一标识
&emsp;&emsp;利用MD5算法，计算文件内容的MD5值，实现文件的唯一性校验。由于MD5在计算大文件时速度较慢，因此采用对大文件第一个文件块和最后一个文件块组合计算的方式，减少计算时间(该方式仍然需要优化处理)。     

### 分片和合并
&emsp;&emsp;首先前端利用[Blob.slice(start?, end?, contentType?)](https://developer.mozilla.org/zh-CN/docs/Web/API/Blob/slice)方法对文件进行切分(File类继承于Blob类)并上传，然后后端将每次上传的分片存储在文件夹中，最后当前端将所有分片上传完成后，后端遍历所有的分片，通过[Files.write(Path path, byte[] bytes, OpenOption options)](https://www.apiref.com/java11-zh/java.base/java/nio/file/Files.html#write(java.nio.file.Path,byte%5B%5D,java.nio.file.OpenOption...))方法并以追加的形式生成新的文件。   

### 秒传和续传
&emsp;&emsp;在正式上传文件前，服务器会先根据上传的文件唯一标识信息，判断文件夹内是否存在该文件，如果存在则通知前端无须上传，从而实现秒传功能。         
&emsp;&emsp;如果在服务器中不存在该文件，但存在该文件的文件块信息，则会统计当前已经上传的文件块个数，并通知前端可以跳过已经上传的部分，从而实现续传功能。    
&emsp;&emsp;如果都不存在，则依次上传所有文件块。     

### 上传状态的监控和信息的实时显示
&emsp;&emsp;通过定义文件上传的各种状态，利用状态机和事件订阅发布的原理，当文件切换到不同的状态时，会触发相应的事件函数，并利用Vue3的响应式原理，实现页面数据的实时更新显示。      

### 多文件和文件块的上传
&emsp;&emsp;当有选择文件上传时，会首先进入到上传文件队列中等待上传，当上传结束时，会出列并继续下一个的文件上传。     
&emsp;&emsp;上传文件块时，会首先利用Axios封装promise请求，然后利用promise.all()依次全部上传。      


# 文件下载模块
## 业务流程
## 技术实现
### 分片和合并 
&emsp;&emsp;在文件下载中，首先前端获取到下载文件的大小。然后根据文件大小和分片的大小，得到每次需要下载的长度范围，并将该范围通过http的headers对象传递给后端，后端利用FileInputStream将文件转为文件流的形式并根据得到的长度范围利用inputStream.skip()跳过之前下载的部分，然后将需要下载的文件流发送至前端。     
&emsp;&emsp;前端将每次下载好的文件块存储到数组中，最后下载完成时，利用Blob(array, options)转为文件并下载到本地。
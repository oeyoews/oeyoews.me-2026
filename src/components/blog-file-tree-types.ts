/** 开发文件树右键 / 拖拽操作上下文（与 {@link ./blog-file-tree} 懒加载 chunk 解耦） */
export type BlogFileTreeDevFsContext =
  | { kind: 'file'; sourcePath: string; treePath: string }
  | { kind: 'dir'; treePath: string }

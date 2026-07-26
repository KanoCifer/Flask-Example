import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarkdownImageEditor } from '@/features/upload/runtime';

function makeFile(name = 'a.png', type = 'image/png'): File {
  return new File(['content'], name, { type });
}

function makeUpload(uploadFn = vi.fn()) {
  return { uploadImage: uploadFn };
}

describe('MarkdownImageEditor', () => {
  let urlCounter = 0;

  beforeEach(() => {
    // 每次测试前先恢复所有 spy,确保 createObjectURL/revokeObjectURL 的
    // mock call 计数不跨用例泄漏。happy-dom 自带的实现返回值不稳定。
    vi.restoreAllMocks();
    urlCounter = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `blob:test/${++urlCounter}`,
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  describe('addImageFile', () => {
    it('返回 ![image](blob:...) markdown 片段并登记到 map', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      const md = editor.addImageFile(makeFile());

      expect(md).toBe('![image](blob:test/1)');
      expect(editor.blobFileMap.value.size).toBe(1);
      expect(editor.blobFileMap.value.get('blob:test/1')?.name).toBe('a.png');
    });

    it('多次调用产生不同的 blob URL', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      const md1 = editor.addImageFile(makeFile('1.png'));
      const md2 = editor.addImageFile(makeFile('2.png'));

      expect(md1).not.toBe(md2);
      expect(editor.blobFileMap.value.size).toBe(2);
    });
  });

  describe('handleImageUpload', () => {
    it('从 input event 提取文件,返回 markdown 片段并清空 input', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      const file = makeFile();
      const input = document.createElement('input');
      input.type = 'file';
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      });
      const event = { target: input } as unknown as Event;

      const md = editor.handleImageUpload(event);

      expect(md).toBe('![image](blob:test/1)');
      expect(input.value).toBe('');
    });

    it('files 为空时返回 null', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', {
        value: [],
        configurable: true,
      });
      const event = { target: input } as unknown as Event;

      expect(editor.handleImageUpload(event)).toBeNull();
    });
  });

  describe('handleDrop', () => {
    it('只接受 image/* 文件,返回对应 markdown 片段列表', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      const png = makeFile('a.png', 'image/png');
      const txt = new File(['x'], 'b.txt', { type: 'text/plain' });
      const dataTransfer = {
        files: [png, txt],
      } as unknown as DataTransfer;

      const event = {
        dataTransfer,
      } as unknown as DragEvent;

      const results = editor.handleDrop(event);

      expect(results).toEqual(['![image](blob:test/1)']);
      expect(editor.blobFileMap.value.size).toBe(1);
    });

    it('files 为空时返回空数组', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      const event = {
        dataTransfer: { files: [] },
      } as unknown as DragEvent;

      expect(editor.handleDrop(event)).toEqual([]);
    });
  });

  describe('handlePaste', () => {
    it('从剪贴板 items 提取 image/* 文件', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      const file = makeFile();

      const item = {
        type: 'image/png',
        getAsFile: () => file,
      };
      const items = {
        length: 1,
        0: item,
        [Symbol.iterator]: function* () {
          yield item;
        },
      };
      const event = {
        clipboardData: { items },
      } as unknown as ClipboardEvent;

      const results = editor.handlePaste(event);

      expect(results).toEqual(['![image](blob:test/1)']);
    });
  });

  describe('openImageEditor', () => {
    it('从 img DOM 提取 alt/title/width/height,align 重置为 center', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      const img = document.createElement('img');
      img.src = 'http://example.com/x.png';
      img.alt = 'alt-text';
      img.setAttribute('title', 'title-text');
      img.setAttribute('width', '300');
      img.setAttribute('height', '200');

      editor.openImageEditor(img);

      expect(editor.editingImageUrl.value).toBe('http://example.com/x.png');
      expect(editor.editingImageAlt.value).toBe('alt-text');
      expect(editor.editingImageTitle.value).toBe('title-text');
      expect(editor.editingImageWidth.value).toBe('300');
      expect(editor.editingImageHeight.value).toBe('200');
      expect(editor.editingImageAlign.value).toBe('center');
      expect(editor.editingImageFile.value).toBeNull();
      expect(editor.isImageEditorOpen.value).toBe(true);
    });

    it('缺少的属性 fallback 为空串', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      const img = document.createElement('img');

      editor.openImageEditor(img);

      expect(editor.editingImageAlt.value).toBe('');
      expect(editor.editingImageTitle.value).toBe('');
      expect(editor.editingImageWidth.value).toBe('');
      expect(editor.editingImageHeight.value).toBe('');
    });
  });

  describe('closeImageEditor', () => {
    it('重置所有 editor 字段并关闭模态', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      // 先打开并填一些值
      const img = document.createElement('img');
      img.alt = 'foo';
      editor.openImageEditor(img);

      editor.closeImageEditor();

      expect(editor.isImageEditorOpen.value).toBe(false);
      expect(editor.editingImageUrl.value).toBe('');
      expect(editor.editingImageAlt.value).toBe('');
      expect(editor.editingImageTitle.value).toBe('');
      expect(editor.editingImageWidth.value).toBe('');
      expect(editor.editingImageHeight.value).toBe('');
      expect(editor.editingImageAlign.value).toBe('center');
      expect(editor.editingImageFile.value).toBeNull();
    });
  });

  describe('handleReplaceImageUpload', () => {
    it('注册新 blob URL 并替换 url 字段', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      const file = makeFile('replacement.png');
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      });
      const event = { target: input } as unknown as Event;

      editor.handleReplaceImageUpload(event);

      expect(editor.editingImageUrl.value).toBe('blob:test/1');
      expect(editor.editingImageFile.value).toBeInstanceOf(File);
      expect((editor.editingImageFile.value as File).name).toBe(
        'replacement.png',
      );
      expect(editor.blobFileMap.value.has('blob:test/1')).toBe(true);
      expect(input.value).toBe('');
    });

    it('alt 为空时用文件名填充', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      const file = makeFile('my-image.png');
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      });
      const event = { target: input } as unknown as Event;

      editor.handleReplaceImageUpload(event);

      expect(editor.editingImageAlt.value).toBe('my-image.png');
    });
  });

  describe('getContentForPublish', () => {
    it('上传所有 blob 图片,替换 markdown 中的 URL,清空 map', async () => {
      const uploadFn = vi
        .fn()
        .mockResolvedValueOnce({ url: 'http://srv/1.png' });
      const editor = new MarkdownImageEditor({ uploadImage: uploadFn });

      editor.addImageFile(makeFile('a.png'));
      const content = '![image](blob:test/1)';
      const result = await editor.getContentForPublish(content);

      expect(uploadFn).toHaveBeenCalledTimes(1);
      const file = uploadFn.mock.calls[0]?.[0] as File;
      expect(file).toBeInstanceOf(File);
      expect(result).toBe('![image](http://srv/1.png)');
      expect(editor.blobFileMap.value.size).toBe(0);
    });

    it('map 为空时原样返回 content,不调用 upload', async () => {
      const uploadFn = vi.fn();
      const editor = new MarkdownImageEditor({ uploadImage: uploadFn });

      const result = await editor.getContentForPublish('plain text');

      expect(uploadFn).not.toHaveBeenCalled();
      expect(result).toBe('plain text');
    });

    it('并发上传多张图片', async () => {
      const uploadFn = vi.fn().mockImplementation(async (file: File) => ({
        url: `http://srv/${file instanceof File ? 'x' : '?'}.png`,
      }));
      const editor = new MarkdownImageEditor({ uploadImage: uploadFn });

      editor.addImageFile(makeFile('a.png'));
      editor.addImageFile(makeFile('b.png'));
      const content = '![a](blob:test/1) and ![b](blob:test/2)';
      const result = await editor.getContentForPublish(content);

      expect(uploadFn).toHaveBeenCalledTimes(2);
      expect(result).toBe('![a](http://srv/x.png) and ![b](http://srv/x.png)');
    });
  });

  describe('dispose', () => {
    it('释放所有 blob URL 并清空 map', () => {
      const editor = new MarkdownImageEditor(makeUpload());
      editor.addImageFile(makeFile('a.png'));
      editor.addImageFile(makeFile('b.png'));

      editor.dispose();

      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
      expect(editor.blobFileMap.value.size).toBe(0);
    });
  });
});

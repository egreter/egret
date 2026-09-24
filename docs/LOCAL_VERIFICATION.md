# 本地验证

GitHub Actions 暂不作为 Egreter V0.1 的验收入口。仓库长期保留 `scripts/test-cli.mjs` 作为开发期端到端测试工具。

## 环境

- Node.js 24 LTS
- pnpm 12.6+

## 首次验证

~~~bash
pnpm install
pnpm test:cli
~~~

`test:cli` 会自动执行：

1. 构建所有 modern `@egreter/*` workspace packages；
2. 验证 `egreter --version`；
3. 用真正的 `egreter create` 生成临时 basic 项目；
4. 将临时项目链接到当前 workspace packages；
5. 执行 `egreter doctor`；
6. 执行 `egreter build`；
7. 检查 `dist/index.html`、静态 asset 和 JavaScript bundle；
8. 启动 `egreter dev`，通过 HTTP 检查首页和 asset，再关闭 dev server；
9. 生成 `.egreter-test/report.json`。

## 调试选项

保留生成项目，方便手工打开：

~~~bash
pnpm test:cli -- --keep
~~~

跳过 dev server，只测 create/build：

~~~bash
pnpm test:cli -- --skip-dev
~~~

如果失败，请把终端错误以及 `.egreter-test/report.json` 一起反馈。后续开发应优先扩展这个脚本，而不是把人工步骤不断写进文档。


## Web host / SDK bootstrap coverage

The same `test:cli` command also exercises the advanced Web host path without network access:

- removes the generated project's root `index.html`;
- forces `targets.web.html: false` and verifies a default host page is generated;
- serves a local classic SDK from `assets/vendor-sdk.js`;
- configures custom script attributes;
- configures `before-scripts`, `before-entry`, and `after-entry` bootstrap modules;
- verifies the generated bootstrap module is available from the dev server;
- verifies the production build still emits `dist/index.html` and the local SDK asset.

This fixture is intentionally local so CLI verification does not depend on a third-party CDN being reachable.

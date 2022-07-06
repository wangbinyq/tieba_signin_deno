import "https://deno.land/std@0.147.0/dotenv/load.ts";
import * as log from "https://deno.land/std@0.147.0/log/mod.ts";
import { Md5 } from "https://deno.land/std@0.147.0/hash/md5.ts";

const LIKE_URL = "https://tieba.baidu.com/mo/q/newmoindex";
const TBS_URL = "http://tieba.baidu.com/dc/common/tbs";
const SIGN_URL = "http://c.tieba.baidu.com/c/c/forum/sign";

class App {
  private headers: Headers;
  private tbs = "";

  constructor(private bduss: string, public idx: number) {
    const headers = new Headers();
    headers.set("cookie", `BDUSS=${bduss}`);
    headers.set(
      "user-agent",
      `Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36`,
    );

    this.headers = headers;
  }

  async run() {
    try {
      await this.get_tbs();
      const follows = await this.get_follows();

      const total = follows.length;
      let success = 0;

      await Promise.all(follows.map(async (follow: string) => {
        try {
          await this.run_sign(follow);
          log.info!(`${follow} 签到成功`);
          success += 1;
        } catch (e) {
          log.info!(`${follow} 签到失败`);
          log.error(e.message);
          log.error(`----------------------------`);
        }
      }));

      log.info!(`第 ${this.idx} 个账号签到完成, 共 ${total} 个, 成功 ${success} 个`);
      log.error(`----------------------------`);
    } catch (e) {
      log.error(`第 ${this.idx} 个账号签到失败:`);
      log.error(e.message);
      log.error(`----------------------------`);
    }
  }

  private async get_tbs() {
    log.info(`第 ${this.idx} 个账号登录中...`);

    const res = await fetch(TBS_URL, { headers: this.headers }).then((res) =>
      res.json()
    );

    if (res.is_login != 1) {
      log.error(`第 ${this.idx} 个账号登录失败，请检查账号密码是否正确`);
    } else {
      this.tbs = res.tbs;
      log.info(`第 ${this.idx} 个账号登录成功`);
    }
  }

  private async get_follows() {
    log.info("开始获取贴吧列表...");
    const res = await fetch(LIKE_URL, { headers: this.headers }).then((res) =>
      res.json()
    );
    const follows = res.data.like_forum.map((item: any) => item.forum_name);

    log.info(`贴吧列表获取成功, 共 ${follows.length} 个!!!`);
    return follows;
  }

  private async run_sign(follow: string) {
    const hasher = new Md5();
    let sign = `kw=${follow}tbs=${this.tbs}tiebaclient!!!`;
    hasher.update(sign);
    sign = hasher.toString("hex");

    const body = `kw=${follow}&tbs=${this.tbs}&sign=${sign}`;

    const res = await fetch(SIGN_URL, {
      headers: this.headers,
      method: "POST",
      body,
    }).then((res) => res.json());

    if (res.error_code !== "0") {
      throw new Error(res.error_msg || `错误码: ${res.error_code}`);
    }
  }
}

if (import.meta.main) {
  const bduss_list = Deno.env.get("BDUSS");

  if (!bduss_list) {
    log.error("BDUSS is not set");
    Deno.exit(1);
  }

  const apps = bduss_list.split(",").map((bduss, idx) =>
    new App(bduss, idx + 1)
  );
  for (const app of apps) {
    await app.run();
  }

  Deno.exit(0);
}

import { parseArgs } from "@std/cli";
import { pooledMap } from "@std/async";
import * as colors from "@std/fmt/colors";
import { sendVote, Vote, VotifierOptions } from "./votifier.ts";

function printHelp() {
  console.log(`${colors.bold(colors.cyan("Usage:"))} votifier-stress [options]

CLI tool to stress test Votifier V2 servers

${colors.bold(colors.yellow("Options:"))}
  --help                 display help for command
  -h, --host <host>      Votifier server host (required)
  -p, --port <port>      Votifier server port (default: 8192)
  -t, --token <token>    Votifier server token (required)
  -u, --username <name>  Username for the vote (default: StressTester)
  -a, --address <addr>   Address for the vote (default: 127.0.0.1)
  -s, --service <name>   Service name for the vote (default: StressService)
  -n, --count <count>    Number of votes to send (default: 10)
  -c, --concurrency <c>  Maximum concurrent votes (default: 5)
`);
}

const args = parseArgs(Deno.args, {
  boolean: ["help"],
  string: ["host", "port", "token", "username", "address", "service", "count", "concurrency"],
  alias: {
    h: "host",
    p: "port",
    t: "token",
    u: "username",
    a: "address",
    s: "service",
    n: "count",
    c: "concurrency",
  },
  default: {
    port: "8192",
    username: "StressTester",
    address: "127.0.0.1",
    service: "StressService",
    count: "10",
    concurrency: "5",
  },
});

if (args.help) {
  printHelp();
  Deno.exit(0);
}

if (!args.host || !args.token) {
  console.error(colors.red("Error: Missing required options: --host and --token"));
  printHelp();
  Deno.exit(1);
}

const host = args.host;
const port = parseInt(args.port);
const token = args.token;
const count = parseInt(args.count);
const concurrency = parseInt(args.concurrency);

class ProgressBar {
  private completed = 0;
  private success = 0;
  private fail = 0;
  private startTime = Date.now();
  private lastUpdate = 0;

  constructor(private total: number) {}

  update(isSuccess: boolean) {
    this.completed++;
    if (isSuccess) this.success++;
    else this.fail++;

    const now = Date.now();
    if (now - this.lastUpdate > 100 || this.completed === this.total) {
      this.render();
      this.lastUpdate = now;
    }
  }

  render() {
    const width = 40;
    const ratio = this.completed / this.total;
    const filled = Math.round(width * ratio);
    const barStr = colors.green("#".repeat(filled)) + colors.gray("-".repeat(width - filled));
    const percent = Math.round(ratio * 100);
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = elapsed > 0 ? (this.completed / elapsed).toFixed(1) : "0.0";

    const line = `\r[${barStr}] ${percent}% | ${colors.green(`S: ${this.success}`)} | ${colors.red(`F: ${this.fail}`)} | ${rate} v/s`;
    Deno.stdout.writeSync(new TextEncoder().encode(line));
  }

  getSuccess() {
    return this.success;
  }

  getFail() {
    return this.fail;
  }
}

async function run() {
  console.log(colors.bold(colors.blue(`Starting stress test on ${host}:${port}`)));
  console.log(`Sending ${colors.yellow(count.toString())} votes with concurrency ${colors.yellow(concurrency.toString())}\n`);

  const bar = new ProgressBar(count);
  const startTime = Date.now();

  const votes = Array.from({ length: count }).map(() => {
    const vote: Vote = {
      username: args.username,
      address: args.address,
      timestamp: Date.now(),
      serviceName: args.service,
    };
    return { host, port, token, vote } as VotifierOptions;
  });

  const results = pooledMap(concurrency, votes, async (options) => {
    try {
      await sendVote(options);
      bar.update(true);
    } catch (_error) {
      bar.update(false);
    }
  });

  for await (const _ of results) {
    // Just iterating through the pooled map
  }

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  console.log(`\n\n${colors.bold(colors.green("Test Finished!"))}`);
  console.log(`${colors.bold("Summary:")}`);
  console.log(`  Success:    ${colors.green(bar.getSuccess().toString())}`);
  console.log(`  Failed:     ${colors.red(bar.getFail().toString())}`);
  console.log(`  Duration:   ${colors.cyan(duration.toFixed(2) + "s")}`);
  console.log(`  Average:    ${colors.bold(colors.magenta((count / duration).toFixed(2)))} votes/s`);
}

run().catch(console.error);

# Votifier Stress Vote

CLI tool to stress test Votifier V2 servers.

## Quick Start

### Run Test
```bash
deno task start -h <HOST> -t <TOKEN> -n 1000 -c 10
```

### Build Binary
```bash
deno task build
./votifier-stress -h <HOST> -t <TOKEN>
```

### Local Mock Test
```bash
# Terminal 1
deno task mock

# Terminal 2
deno task start -h 127.0.0.1 -p 8193 -t MYTOKEN
```

## Options

| Option | Description | Default |
| --- | --- | --- |
| `-h, --host` | Votifier server host (**Required**) | - |
| `-t, --token` | Votifier server token (**Required**) | - |
| `-p, --port` | Votifier server port | `8192` |
| `-n, --count` | Number of votes to send | `10` |
| `-c, --concurrency`| Maximum concurrent votes | `5` |
| `-u, --username`| Username for the vote | `StressTester` |

See `deno task start --help` for all options.

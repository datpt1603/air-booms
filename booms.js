const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');
const colors = require('colors');

class Booms {
    constructor() {
        this.headers = {
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'en-GB,en;q=0.9,en-US;q=0.8,ja;q=0.7',
            'baggage': 'sentry-trace_id=03e194251d6744e5840b7ce5df7f0e3c,sentry-public_key=69504d8e9af95b7f23d1bc4c41d73113,sentry-release=app%401.16.1%2B1991548,sentry-environment=production,sentry-transaction=POST%20%2Fv1%2Fauth%2Fcreate-session,sentry-sample_rate=0.01,sentry-sampled=false',
            'content-type': 'application/json',
            'Origin': 'https://booms.io',
            'Referer': 'https://booms.io/',
            'sec-ch-ua': '"Microsoft Edge";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"',
            'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 Edg/129.0.0.0',
        }

        this.client_id = '54377749bba6e66d85f82d626d2ba461';
        this.client_build = '1.16.1+1991548';

        this.authUrl = 'https://api.booms.io/v1/auth/create-session';
        this.selfUrl = 'https://api.booms.io/v1/profiles/self';
        this.tapUrl = 'https://api.booms.io/v1/profiles/tap';
        this.tasksUrl = 'https://api.booms.io/v1/tasks';
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`);
        }
    }

    async waitWithCountdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== Đã hoàn thành tất cả tài khoản, chờ ${i} giây để tiếp tục vòng lặp =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    async countdown(t) {
        for (let i = t; i > 0; i--) {
            const hours = String(Math.floor(i / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((i % 3600) / 60)).padStart(2, '0');
            const seconds = String(i % 60).padStart(2, '0');
            process.stdout.write(colors.white(`[*] Cần chờ ${hours}:${minutes}:${seconds}     \r`));
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        process.stdout.write('                                        \r');
    }

    async auth(initData, no) {
        try {
            const res = await axios.post(this.authUrl, {
                'client_build': this.client_build,
                'client_id': this.client_id,
                'telegram_init_data': initData,
            }, { headers: this.headers });

            if (res.status === 200) {
                return res.data.token;
            } else {
                return null;
            }
        } catch (error) {
            this.log(`Lỗi khi xử lý tài khoản ${no + 1}: ${error.message}`, error);
            return null;
        }
    }

    async self(token, no) {
        try {
            const res = await axios.get(this.selfUrl, {headers: {...this.headers, 'Authorization': `Bearer ${token}`}});

            if (res.status === 200) {
                return res.data;
            } else {
                return null;
            }
        } catch (error) {
            this.log(`Lỗi khi xử lý tài khoản ${no + 1}: ${error.message}`, error);
            return null;
        }
    }

    async tap(token, no) {
        try {
            const selfData = await this.self(token, no);

            if (selfData) {
                const energyCurrentValue = selfData.energy_current_value;
                const energyMaxValue = selfData.energy_max_value;
                const coinsBalance = selfData.coins_balance;
                const name = selfData.name;
                const id = selfData.id;

                this.log('Name: ' + name);
                this.log('ID: ' + id);
                this.log('Balance: ' + coinsBalance);
                this.log('Energy: ' + energyCurrentValue + '/' + energyMaxValue);

                if (energyCurrentValue <= energyMaxValue) {
                    const now = new Date();
                    const formattedDate = now.toISOString();
                    const res = await axios.post(this.tapUrl, {
                        tapped_from: formattedDate,
                        taps_count: energyCurrentValue
                    },
                    {headers: {...this.headers, 'Authorization': `Bearer ${token}`}});

                    if (res.status === 200) {
                        this.log(`Đã nhận ${energyCurrentValue}`, 'success');
                    } else {
                        this.log('Tap không thành công...chuyển tài khoản!', 'warning');
                    }
                } else {
                    this.log('Năng lượng quá thấp để tiếp tục tap...chuyển tài khoản!', 'warning');
                }
            }
        } catch (error) {
            this.log(`Lỗi khi thực hiện tap: ${error.message}`, error);
        }
    }

    async tasks(token, no) {
        try {
            const res = await axios.get(this.tasksUrl, {headers: {...this.headers, 'Authorization': `Bearer ${token}`}});

            if (res.status === 200) {
                return res.data.items;
            }

            return null;
        } catch (error) {
            this.log(`Lỗi khi xử lý tài khoản ${no + 1} ở tasks: ${error.message}`, error);
            return null;
        }
    }

    async processTasks(token, no) {
        try {
            const tasks = await this.tasks(token, no);
            tasks = tasks.filter(task => !task.completed_at && !/Invite|friends/i.test(task.title));

            for (let task of tasks) {
                try {
                    const res = await axios.post(`https://api.booms.io/v1/tasks/${task.id}/submit`, {}, {headers: {...this.headers, 'Authorization': `Bearer ${token}`}});
                    if (res.status === 200) {
                        this.log(`Đã hoàn thành task: ${task.id}`, 'success');
                    } else {
                        this.log(`Task ${task.id} không hoàn thành được`, 'warning');
                    }
                } catch (error) {
                    this.log(`Task ${task.id} không hoàn thành được`, 'warning');
                    continue;
                }
            }
        } catch (error) {
            this.log(`Lỗi khi xử lý tài khoản ${no + 1} ở processTasks: ${error.message}`, error);
        }
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const initDataList = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let no = 0; no < initDataList.length; no++) {
                const initData = initDataList[no];
                try {
                    const authResponse = await this.auth(initData, no);

                    if (authResponse) {
                        await this.tap(authResponse, no);

                        await this.countdown(5);

                        //await this.processTasks(authResponse, no);
                    }

                    await this.countdown(10);
                } catch (err) {
                    this.log(`Lỗi khi xử lý tài khoản ${no + 1}: ${error.message}`, error);
                }
            }

            await this.waitWithCountdown(Math.floor(2610));
        }
    }
}

if (require.main === module) {
    const booms = new Booms();
    booms.main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
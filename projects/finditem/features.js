// Feature detail data
const featureDetails = {
    zh: {
        1: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            title: '关键词搜索',
            subtitle: '输入名称、型号或类别，实时匹配，不用翻箱倒柜',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">工作原理</h3>
                <p style="margin-bottom:24px">系统采用关键词匹配，支持按零件名称、型号、类别进行搜索。不需要记住精确的零件编号，输入部分关键词即可实时匹配。</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
                    <div style="background:var(--surface);border-radius:12px;padding:20px">
                        <div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> 名称搜索</div>
                        <div style="font-size:13px;color:var(--text-dim)">输入"M3 螺丝"即可匹配所有 M3 系列螺丝</div>
                    </div>
                    <div style="background:var(--surface);border-radius:12px;padding:20px">
                        <div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg> 型号搜索</div>
                        <div style="font-size:13px;color:var(--text-dim)">输入型号如"WS2812B"精确匹配零件</div>
                    </div>
                    <div style="background:var(--surface);border-radius:12px;padding:20px">
                        <div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> 类别搜索</div>
                        <div style="font-size:13px;color:var(--text-dim)">按分类浏览：螺丝、轴承、电控、传感器等</div>
                    </div>
                    <div style="background:var(--surface);border-radius:12px;padding:20px">
                        <div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> 实时匹配</div>
                        <div style="font-size:13px;color:var(--text-dim)">输入即显示匹配结果</div>
                    </div>
                </div>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">技术实现</h3>
                <p>本案例页在浏览器中读取静态示意数据并完成关键词匹配；不会连接学校网络、后端或实体设备</p>
            `
        },
        2: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            title: '多人并发（规划中）',
            subtitle: '设计目标：最多 7 人同时查找，每人分配不同颜色的 LED 和蜂鸣器节奏',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">并发机制</h3>
                <p style="margin-bottom:24px">规划功能：支持多名用户同时查找不同零件。每个用户分配独立的颜色和蜂鸣节奏</p>
                <div style="margin-bottom:24px">
                    <div style="font-weight:600;margin-bottom:12px">颜色编码方案</div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap">
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#ff3b30"></div>用户 1
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#ff9500"></div>用户 2
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#ffcc00"></div>用户 3
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#34c759"></div>用户 4
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#007aff"></div>用户 5
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#5856d6"></div>用户 6
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#af52de"></div>用户 7
                        </div>
                    </div>
                </div>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">蜂鸣器节奏区分</h3>
                <p>每位用户的蜂鸣器频率和节奏模式不同（快速/中速/慢速/间歇），即使在嘈杂的比赛准备环境中也能辨别出自己的目标箱子</p>
            `
        },
        3: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
            title: '飞书登录（规划中）',
            subtitle: '规划中：可选的 OAuth 身份验证，自托管可控',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">安全保障</h3>
                <p style="margin-bottom:24px">规划功能：可选接入飞书 OAuth 2.0 进行身份验证，限定允许使用的用户范围</p>
                <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:24px">
                    <div style="display:flex;align-items:flex-start;gap:12px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="min-width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--accent-on);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">1</div>
                        <div><div style="font-weight:600;margin-bottom:4px">扫码登录</div><div style="font-size:13px;color:var(--text-dim)">用飞书扫描网页上的二维码，一键完成身份验证</div></div>
                    </div>
                    <div style="display:flex;align-items:flex-start;gap:12px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="min-width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--accent-on);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">2</div>
                        <div><div style="font-weight:600;margin-bottom:4px">权限校验</div><div style="font-size:13px;color:var(--text-dim)">系统自动验证用户是否属于你配置的允许群组</div></div>
                    </div>
                    <div style="display:flex;align-items:flex-start;gap:12px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="min-width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--accent-on);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">3</div>
                        <div><div style="font-weight:600;margin-bottom:4px">角色分配</div><div style="font-size:13px;color:var(--text-dim)">管理员和普通用户拥有不同的操作权限</div></div>
                    </div>
                </div>
            `
        },
        4: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
            title: '电量监控（规划中）',
            subtitle: '规划中：电池电压监测与低电量通知',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">智能监控</h3>
                <p style="margin-bottom:24px">规划功能：每个 FindItem 设备内置电压检测电路，实时监测电池状态</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
                    <div style="background:var(--surface);border-radius:12px;padding:20px;text-align:center">
                        <div style="font-size:36px;font-weight:700;color:var(--accent-ink)">3.3V</div>
                        <div style="font-size:13px;color:var(--text-dim);margin-top:4px">工作电压</div>
                    </div>
                    <div style="background:var(--surface);border-radius:12px;padding:20px;text-align:center">
                        <div style="font-size:36px;font-weight:700;color:#ff9500">&lt;3.0V</div>
                        <div style="font-size:13px;color:var(--text-dim);margin-top:4px">低电量警报阈值</div>
                    </div>
                </div>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">通知机制</h3>
                <p>规划功能：低电压时通过飞书机器人向管理员发送提醒，包含设备编号和电压值</p>
            `
        },
        5: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
            title: '零件管理',
            subtitle: '管理员可增删改查零件信息，按名称、型号、类别搜索',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">管理后台</h3>
                <p style="margin-bottom:24px">规划功能：管理员通过 Web 后台管理零件信息，支持 CRUD 操作</p>
                <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:24px">
                    <div style="display:flex;align-items:center;gap:16px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg></div>
                        <div><div style="font-weight:600">添加零件</div><div style="font-size:13px;color:var(--text-dim)">录入零件名称、型号、类别，指定存放箱子</div></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:16px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></div>
                        <div><div style="font-weight:600">编辑信息</div><div style="font-size:13px;color:var(--text-dim)">修改零件信息或调整存放位置</div></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:16px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></div>
                        <div><div style="font-weight:600">删除零件</div><div style="font-size:13px;color:var(--text-dim)">移除已用完或不再需要的零件记录</div></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:16px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>
                        <div><div style="font-weight:600">箱子管理</div><div style="font-size:13px;color:var(--text-dim)">每个箱子最多 3 种零件，清晰明了，避免混乱</div></div>
                    </div>
                </div>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">数据结构</h3>
                <div style="background:var(--surface);border-radius:12px;padding:16px;font-family:monospace;font-size:13px;line-height:1.8">
                    <div style="color:var(--accent-ink)">FINDIT-001</div>
                    <div>├── M3×10 螺丝 <span style="color:var(--text-dim)">(螺丝)</span></div>
                    <div>├── M5 防松螺母 <span style="color:var(--text-dim)">(螺母)</span></div>
                    <div>└── 垫片 M5×12×1 <span style="color:var(--text-dim)">(垫片)</span></div>
                    <div style="color:var(--accent-ink);margin-top:8px">FINDIT-003</div>
                    <div>├── 公制轴承 D5 <span style="color:var(--text-dim)">(轴承)</span></div>
                    <div>├── Falcon 起步齿轮 <span style="color:var(--text-dim)">(齿轮)</span></div>
                    <div>└── 公制法兰轴承 D8 <span style="color:var(--text-dim)">(轴承)</span></div>
                </div>
            `
        }
    },
    en: {
        1: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            title: 'Smart Search',
            subtitle: 'Search by name, model, or category with instant keyword matching',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">How It Works</h3>
                <p style="margin-bottom:24px">The system uses keyword matching to find parts by name, model number, or category. No need to remember exact part numbers — just type a partial keyword and get instant results</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
                    <div style="background:var(--surface);border-radius:12px;padding:20px">
                        <div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> Name Search</div>
                        <div style="font-size:13px;color:var(--text-dim)">Type "M3 screw" to match all M3 series</div>
                    </div>
                    <div style="background:var(--surface);border-radius:12px;padding:20px">
                        <div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg> Model Search</div>
                        <div style="font-size:13px;color:var(--text-dim)">Enter model numbers like "WS2812B" for exact matches</div>
                    </div>
                    <div style="background:var(--surface);border-radius:12px;padding:20px">
                        <div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Category Browse</div>
                        <div style="font-size:13px;color:var(--text-dim)">Browse by type: screws, bearings, electronics, sensors</div>
                    </div>
                    <div style="background:var(--surface);border-radius:12px;padding:20px">
                        <div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Instant Results</div>
                        <div style="font-size:13px;color:var(--text-dim)">Results appear as you type</div>
                    </div>
                </div>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">Tech Details</h3>
                <p>This case-study page matches keywords against static demo data in the browser; it does not connect to a school network, backend, or physical device</p>
            `
        },
        2: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            title: 'Multi-user (Planned)',
            subtitle: 'Design target: up to 7 people searching simultaneously with unique LED colors and beep patterns',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">Concurrency</h3>
                <p style="margin-bottom:24px">Planned feature: support for multiple concurrent users searching for different parts. Each user gets a unique color and beep pattern</p>
                <div style="margin-bottom:24px">
                    <div style="font-weight:600;margin-bottom:12px">Color Coding</div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap">
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#ff3b30"></div>User 1
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#ff9500"></div>User 2
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#ffcc00"></div>User 3
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#34c759"></div>User 4
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#007aff"></div>User 5
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#5856d6"></div>User 6
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px">
                            <div style="width:12px;height:12px;border-radius:50%;background:#af52de"></div>User 7
                        </div>
                    </div>
                </div>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">Audio Distinction</h3>
                <p>Each user gets a unique buzzer frequency and rhythm pattern (fast/medium/slow/intermittent), so you can identify your target box even in a noisy competition environment</p>
            `
        },
        3: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
            title: 'Feishu Login (planned)',
            subtitle: 'Optional OAuth authentication — self-hostable and under your control',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">Security</h3>
                <p style="margin-bottom:24px">Planned feature: optional Feishu OAuth 2.0 authentication, restricting access to configured user groups</p>
                <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:24px">
                    <div style="display:flex;align-items:flex-start;gap:12px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="min-width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--accent-on);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">1</div>
                        <div><div style="font-weight:600;margin-bottom:4px">QR Code Login</div><div style="font-size:13px;color:var(--text-dim)">Scan the QR code on the webpage with Feishu for one-tap authentication</div></div>
                    </div>
                    <div style="display:flex;align-items:flex-start;gap:12px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="min-width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--accent-on);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">2</div>
                        <div><div style="font-weight:600;margin-bottom:4px">Access Control</div><div style="font-size:13px;color:var(--text-dim)">System verifies membership in the group you configure</div></div>
                    </div>
                    <div style="display:flex;align-items:flex-start;gap:12px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="min-width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--accent-on);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">3</div>
                        <div><div style="font-weight:600;margin-bottom:4px">Role Assignment</div><div style="font-size:13px;color:var(--text-dim)">Admins and regular members get different permission levels</div></div>
                    </div>
                </div>
            `
        },
        4: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
            title: 'Battery Monitor (planned)',
            subtitle: 'Planned: voltage monitoring with low-battery alerts via Feishu',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">Smart Monitoring</h3>
                <p style="margin-bottom:24px">Planned feature: each FindItem unit has a built-in voltage sensing circuit that monitors battery status</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
                    <div style="background:var(--surface);border-radius:12px;padding:20px;text-align:center">
                        <div style="font-size:36px;font-weight:700;color:var(--accent-ink)">3.3V</div>
                        <div style="font-size:13px;color:var(--text-dim);margin-top:4px">Operating Voltage</div>
                    </div>
                    <div style="background:var(--surface);border-radius:12px;padding:20px;text-align:center">
                        <div style="font-size:36px;font-weight:700;color:#ff9500">&lt;3.0V</div>
                        <div style="font-size:13px;color:var(--text-dim);margin-top:4px">Low Battery Threshold</div>
                    </div>
                </div>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">Alert System</h3>
                <p>Planned feature: low-battery alerts to admins via Feishu bot, including device ID and voltage</p>
            `
        },
        5: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
            title: 'Parts Management (planned)',
            subtitle: 'Planned: admins can add, edit, and search parts by name, model, or category',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">Admin Dashboard</h3>
                <p style="margin-bottom:24px">Planned feature: admins manage parts through a web dashboard with CRUD operations</p>
                <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:24px">
                    <div style="display:flex;align-items:center;gap:16px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg></div>
                        <div><div style="font-weight:600">Add Parts</div><div style="font-size:13px;color:var(--text-dim)">Enter part name, model, category, and assign a storage box</div></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:16px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></div>
                        <div><div style="font-weight:600">Edit Info</div><div style="font-size:13px;color:var(--text-dim)">Update part details or change storage location</div></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:16px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></div>
                        <div><div style="font-weight:600">Remove Parts</div><div style="font-size:13px;color:var(--text-dim)">Delete used or obsolete part records</div></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:16px;background:var(--surface);border-radius:12px;padding:16px">
                        <div style="display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>
                        <div><div style="font-weight:600">Box Management</div><div style="font-size:13px;color:var(--text-dim)">Max 3 part types per box — clean and organized</div></div>
                    </div>
                </div>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">Data Structure</h3>
                <div style="background:var(--surface);border-radius:12px;padding:16px;font-family:monospace;font-size:13px;line-height:1.8">
                    <div style="color:var(--accent-ink)">FINDIT-001</div>
                    <div>├── M3×10 Screw <span style="color:var(--text-dim)">(Screw)</span></div>
                    <div>├── M5 Lock Nut <span style="color:var(--text-dim)">(Nut)</span></div>
                    <div>└── Washer M5×12×1 <span style="color:var(--text-dim)">(Washer)</span></div>
                    <div style="color:var(--accent-ink);margin-top:8px">FINDIT-003</div>
                    <div>├── Metric Bearing D5 <span style="color:var(--text-dim)">(Bearing)</span></div>
                    <div>├── Falcon Starter Gear <span style="color:var(--text-dim)">(Gear)</span></div>
                    <div>└── Metric Flange Bearing D8 <span style="color:var(--text-dim)">(Bearing)</span></div>
                </div>
            `
        }
    }
};

function openFeature(id) {
    const dict = lang === 'zh' ? featureDetails.zh : featureDetails.en;
    const feature = dict[id];
    if (!feature) return;

    const modal = document.getElementById('feature-modal');
    const content = document.getElementById('modal-content');

    document.getElementById('modal-icon').innerHTML = feature.icon;
    document.getElementById('modal-title').textContent = feature.title;
    document.getElementById('modal-subtitle').textContent = feature.subtitle;
    document.getElementById('modal-body').innerHTML = feature.body;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    onModalOpen();

    // Animate in
    requestAnimationFrame(() => {
        content.style.transform = 'translateY(0)';
        content.style.opacity = '1';
    });
}

function closeFeature() {
    const modal = document.getElementById('feature-modal');
    const content = document.getElementById('modal-content');

    content.style.transform = 'translateY(20px)';
    content.style.opacity = '0';

    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        if (lastModalFocus) { try { lastModalFocus.focus(); } catch (err) {} lastModalFocus = null; }
    }, 300);
}

// ===== Modal a11y: dialog focus management, focus trap, Escape =====
let lastModalFocus = null;
function onModalOpen() {
    const modal = document.getElementById('feature-modal');
    lastModalFocus = document.activeElement;
    requestAnimationFrame(() => {
        const closeBtn = modal.querySelector('button');
        if (closeBtn) closeBtn.focus();
    });
}
function modalIsOpen() {
    const modal = document.getElementById('feature-modal');
    return !!modal && modal.style.display === 'flex';
}
document.addEventListener('keydown', e => {
    if (!modalIsOpen()) return;
    if (e.key === 'Escape') { closeFeature(); return; }
    if (e.key === 'Tab') {
        const modal = document.getElementById('feature-modal');
        const f = modal.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
});

// ===== How-It-Works step details (opened from the 三步找到零件 / Three Steps section) =====
const stepDetails = {
    zh: {
        1: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            title: '01 · 搜索',
            subtitle: '本页用静态流程演示未来的二维码 / 飞书入口与目录搜索',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">怎么进入</h3>
                <p style="margin-bottom:24px">规划设想：未来可为箱体贴二维码，并选择性接入飞书机器人；学校 30 箱现场尚未安装这些入口，本页点击只会进入静态模拟。</p>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">怎么搜索</h3>
                <p style="margin-bottom:24px">采用关键词匹配，不用记住精确编号——输入「M3 螺丝」「轴承」「齿轮」等关键词，结果实时显示。</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                    <div style="background:var(--surface);border-radius:12px;padding:18px"><div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> 名称搜索</div><div style="font-size:13px;color:var(--text-dim)">输入名称即可匹配同系列零件</div></div>
                    <div style="background:var(--surface);border-radius:12px;padding:18px"><div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg> 型号搜索</div><div style="font-size:13px;color:var(--text-dim)">按精确型号快速定位</div></div>
                    <div style="background:var(--surface);border-radius:12px;padding:18px"><div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> 类别浏览</div><div style="font-size:13px;color:var(--text-dim)">按螺丝 / 轴承 / 电控等分类查找</div></div>
                    <div style="background:var(--surface);border-radius:12px;padding:18px"><div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> 实时匹配</div><div style="font-size:13px;color:var(--text-dim)">边输入边出结果</div></div>
                </div>
            `
        },
        2: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
            title: '02 · 定位',
            subtitle: '单箱原型已验证 LED、蜂鸣器与 MQTT；本页只模拟定位状态',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">单箱参考原型</h3>
                <p style="margin-bottom:24px">已完成的单箱原型可通过 MQTT 指令点亮 LED、触发蜂鸣器；本案例页只用动画演示这一状态，不会发送真机指令。</p>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">多人同时找也不会乱</h3>
                <p style="margin-bottom:20px">规划中：多人同时查找，每人分配不同颜色的 LED 和不同节奏的蜂鸣，各找各的，互不干扰。</p>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#ff3b30"></div>用户 1</div>
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#ff9500"></div>用户 2</div>
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#ffcc00"></div>用户 3</div>
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#34c759"></div>用户 4</div>
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#007aff"></div>用户 5</div>
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#5856d6"></div>用户 6</div>
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#af52de"></div>用户 7</div>
                </div>
            `
        },
        3: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>',
            title: '03 · 取件',
            subtitle: '拿到零件，点击确认，响铃停止——全程通常几秒内（设计目标）',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">取件即完成</h3>
                <p style="margin-bottom:24px">目标交互是取件后在手机上确认并停止对应箱子的灯光和蜂鸣；本页确认按钮只结束静态动画，一排与 30 箱联动仍待试点验证。</p>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">又快又准</h3>
                <p style="margin-bottom:24px">从搜索到取件，比翻箱倒柜快得多，也避免了零件错拿、乱放。</p>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
                    <div style="background:var(--surface);border-radius:12px;padding:18px;text-align:center"><div style="font-size:28px;font-weight:700;color:var(--accent-ink)">快速</div><div style="font-size:13px;color:var(--text-dim);margin-top:4px">定位用时</div></div>
                    <div style="background:var(--surface);border-radius:12px;padding:18px;text-align:center"><div style="font-size:28px;font-weight:700;color:var(--accent-ink)">演示</div><div style="font-size:13px;color:var(--text-dim);margin-top:4px">零件箱数</div></div>
                    <div style="background:var(--surface);border-radius:12px;padding:18px;text-align:center"><div style="font-size:28px;font-weight:700;color:var(--accent-ink)">规划</div><div style="font-size:13px;color:var(--text-dim);margin-top:4px">并发数</div></div>
                </div>
            `
        }
    },
    en: {
        1: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            title: '01 · Search',
            subtitle: 'A static flow previews future QR / Feishu entry and catalog search',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">How to get in</h3>
                <p style="margin-bottom:24px">Planned concept: future bins could carry QR labels and optionally use a Feishu bot. Neither entry path is installed at the 30-bin school site; clicking here only enters the static simulation.</p>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">How to search</h3>
                <p style="margin-bottom:24px">Keyword matching means you don't need exact part numbers — type "M3 screw", "bearing", "gear" and results appear instantly.</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                    <div style="background:var(--surface);border-radius:12px;padding:18px"><div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> By Name</div><div style="font-size:13px;color:var(--text-dim)">Match a whole series by name</div></div>
                    <div style="background:var(--surface);border-radius:12px;padding:18px"><div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg> By Model</div><div style="font-size:13px;color:var(--text-dim)">Pinpoint an exact model number</div></div>
                    <div style="background:var(--surface);border-radius:12px;padding:18px"><div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> By Category</div><div style="font-size:13px;color:var(--text-dim)">Browse screws / bearings / electronics</div></div>
                    <div style="background:var(--surface);border-radius:12px;padding:18px"><div style="font-weight:600;margin-bottom:6px"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:4px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Instant</div><div style="font-size:13px;color:var(--text-dim)">Results as you type</div></div>
                </div>
            `
        },
        2: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
            title: '02 · Locate',
            subtitle: 'The one-bin prototype validates LED, buzzer and MQTT; this page only simulates the locate state',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">One-bin reference prototype</h3>
                <p style="margin-bottom:24px">The completed one-bin prototype can receive an MQTT command, light its LED and trigger its buzzer. This case-study page only animates that state and sends no hardware command.</p>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">No chaos with many users</h3>
                <p style="margin-bottom:20px">Planned: multiple people can search at once — each gets a unique LED color and buzzer rhythm, so everyone finds their own part without interference.</p>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#ff3b30"></div>User 1</div>
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#ff9500"></div>User 2</div>
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#ffcc00"></div>User 3</div>
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#34c759"></div>User 4</div>
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#007aff"></div>User 5</div>
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#5856d6"></div>User 6</div>
                    <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border-radius:8px;padding:8px 14px"><div style="width:12px;height:12px;border-radius:50%;background:#af52de"></div>User 7</div>
                </div>
            `
        },
        3: {
            icon: '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:var(--accent-ink);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>',
            title: '03 · Pick Up',
            subtitle: 'Grab the part, tap confirm, the buzzer stops — typically a few seconds (design target) total',
            body: `
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">Done on pickup</h3>
                <p style="margin-bottom:24px">The target interaction is to confirm pickup on a phone and stop that bin's light and buzzer. Here, "Part Retrieved" only ends the static animation; one-row and 30-bin control still need pilot validation.</p>
                <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;color:var(--text)">Fast and precise</h3>
                <p style="margin-bottom:24px">From search to pickup, the whole thing usually takes typically a few seconds (design target) — far faster than rummaging, and it prevents grabbing or misplacing the wrong part.</p>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
                    <div style="background:var(--surface);border-radius:12px;padding:18px;text-align:center"><div style="font-size:28px;font-weight:700;color:var(--accent-ink)">Fast</div><div style="font-size:13px;color:var(--text-dim);margin-top:4px">Locate time (target)</div></div>
                    <div style="background:var(--surface);border-radius:12px;padding:18px;text-align:center"><div style="font-size:28px;font-weight:700;color:var(--accent-ink)">30</div><div style="font-size:13px;color:var(--text-dim);margin-top:4px">Planned bins</div></div>
                    <div style="background:var(--surface);border-radius:12px;padding:18px;text-align:center"><div style="font-size:28px;font-weight:700;color:var(--accent-ink)">7</div><div style="font-size:13px;color:var(--text-dim);margin-top:4px">Concurrent (planned)</div></div>
                </div>
            `
        }
    }
};

function openStep(id) {
    const dict = lang === 'zh' ? stepDetails.zh : stepDetails.en;
    const step = dict[id];
    if (!step) return;

    document.getElementById('modal-icon').innerHTML = step.icon;
    document.getElementById('modal-title').textContent = step.title;
    document.getElementById('modal-subtitle').textContent = step.subtitle;
    document.getElementById('modal-body').innerHTML = step.body;

    const modal = document.getElementById('feature-modal');
    const content = document.getElementById('modal-content');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    onModalOpen();
    requestAnimationFrame(() => {
        content.style.transform = 'translateY(0)';
        content.style.opacity = '1';
    });
}

window.__ModuleLoader__.load({
	id: "dsh-nook",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");
		const h = react.createElement;
		const { useState, useEffect, useCallback } = react;

		/** Sidebar entry and page key. */
		const PANEL_ID = "nook";
		const API = "/api/dsh-nook";

		const AREAS = {
			routine: "作息和日常",
			work: "工作或学习",
			people: "身边重要的人",
			likes: "喜欢的东西",
			dislikes: "不喜欢、雷区",
			worries: "最近的烦恼",
			hopes: "想做的事",
			past: "过去的故事",
			place: "住在哪里",
		};
		const KNOW_LEVELS = ["还不了解", "知道一点", "了解", "很了解"];
		const SOURCE = { confirmed: "已确认", inferred: "推测", self: "她的经历" };
		const TRAITS = { E: "外向", A: "宜人", C: "尽责", N: "情绪敏感", O: "开放" };
		const OUTREACH = { low: "少", medium: "适中", high: "常" };

		const CSS = `
.nook,.nook-ov{--nb:#3d6bfd;--nb2:#2f55e0;--nbs:#eef2ff;--nl:#efebe4;--nt:#2a2722;--ns:#6b6660;--nm:#a39d95;--paper:#fdf8ef;color:var(--nt);font-size:14px;line-height:1.65;-webkit-font-smoothing:antialiased}
.nook{height:100%;overflow:auto;background:#fcfaf6}
.nook-ov *{box-sizing:border-box}
.nook *{box-sizing:border-box}
.nook-wrap{max-width:1120px;margin:0 auto;padding:36px 48px 64px}
.nook-head{display:flex;align-items:center;gap:20px;margin-bottom:22px;position:relative;min-height:120px}
.nook-scene{position:absolute;right:150px;top:-36px;height:180px;width:600px;pointer-events:none}
.nook-scene img{position:absolute;right:0;top:0;height:180px;transition:opacity .2s ease}
.nook-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px}
.nook-flip{perspective:900px;height:210px;cursor:pointer}
.nook-flip .in{position:relative;width:100%;height:100%;transition:transform .5s cubic-bezier(.3,.7,.3,1);transform-style:preserve-3d}
.nook-flip.on .in{transform:rotateY(180deg)}
.nook-flip .fc{position:absolute;inset:0;backface-visibility:hidden;border-radius:16px;padding:14px 16px;overflow:hidden}
.nook-flip .front{background:#fff;border:1px solid var(--nl);box-shadow:0 2px 10px rgba(80,60,30,.05);display:flex;flex-direction:column;align-items:center;text-align:center}
.nook-flip .front img{width:96px;height:96px;object-fit:contain;margin:4px 0 6px}
.nook-flip .front .t{font-size:13.5px;font-weight:600;line-height:1.5}
.nook-flip .front .d{font-size:12px;color:var(--nm);margin-top:auto}
.nook-flip .back{background:var(--paper);transform:rotateY(180deg);font-size:13px;line-height:1.7;overflow:auto}
.nook-flip .back .q{color:var(--nb2);margin-top:8px}
.nook-flip .back .q:before{content:"“"}.nook-flip .back .q:after{content:"”"}
.nook-drawer-mask{position:fixed;inset:0;background:rgba(30,26,20,.12);z-index:60}
.nook-drawer{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:92vw;background:#fcfaf6;border-left:1px solid #efebe4;box-shadow:-12px 0 40px rgba(30,26,20,.08);z-index:61;overflow:auto;padding:22px 24px 40px;animation:nookslide .22s ease}
@keyframes nookslide{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
.nook-drawer h4{font-size:13px;color:var(--nm);font-weight:500;margin:22px 0 6px}
.nook-pin{display:inline-flex;align-items:center;gap:6px;border:1px solid #e6e1d8;background:#fff;border-radius:999px;padding:4px 12px;font-size:12.5px;color:#4a453e;cursor:pointer}
.nook-pin img{width:18px;height:18px;object-fit:contain}
.nook-spot{width:52px;height:52px;object-fit:contain;margin:-10px 6px -10px -6px;vertical-align:-16px}
.nook-spotbig{width:120px;height:120px;object-fit:contain;display:block;margin:6px auto 4px;opacity:.9}
.nook-av{width:64px;height:64px;border-radius:50%;background:linear-gradient(145deg,#eef2ff,#dbe4ff);color:var(--nb2);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:600;flex:none}
.nook-avimg{object-fit:cover;box-shadow:0 0 0 3px #fff,0 0 0 4px #e6ebf5,0 6px 18px rgba(24,32,46,.08)}
.nook-name{font-size:28px;font-weight:650;letter-spacing:-.01em;line-height:1.2}
.nook-sub{font-size:13px;color:var(--nm);margin-top:4px}
.nook-btn{white-space:nowrap;border:1px solid #dfe5f2;background:#fff;color:var(--nt);border-radius:999px;padding:7px 16px;font-size:13px;cursor:pointer;transition:all .15s}
.nook-btn:hover{border-color:#c7d3f5;background:#fafbff}
.nook-btn.pri{border:none;color:#fff;padding:10px 22px;font-size:14px;font-weight:550;background:linear-gradient(180deg,#5b82ff 0%,#3d6bfd 55%,#3460ee 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 1px 2px rgba(29,59,160,.25),0 6px 16px rgba(61,107,253,.22)}
.nook-btn.pri:hover{transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 2px 4px rgba(29,59,160,.25),0 10px 22px rgba(61,107,253,.28)}
.nook-btn:disabled{opacity:.5;cursor:default;transform:none}
.nook-link{color:var(--nm);cursor:pointer;font-size:12.5px;background:none;border:none;padding:0}
.nook-link:hover{color:var(--nb2)}
.nook-tabs{display:flex;gap:28px;border-bottom:1px solid var(--nl);margin-bottom:30px}
.nook-tab{background:none;border:none;padding:10px 0 12px;font-size:15px;color:var(--ns);cursor:pointer;position:relative}
.nook-tab.on{color:var(--nb2);font-weight:600}
.nook-tab.on:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:2px;background:var(--nb)}
.nook-cols{display:grid;grid-template-columns:1.15fr 1fr;gap:56px}
.nook-col+.nook-col{border-left:1px solid var(--nl);padding-left:56px;margin-left:-28px}
.nook-sec{margin-bottom:38px}
.nook-sec>h3{font-size:19px;font-weight:650;margin:0 0 16px;letter-spacing:-.01em}
.nook-cap{font-size:12.5px;color:var(--nm);margin:0 0 8px}
.nook-thread{display:flex;gap:16px;align-items:flex-start;background:linear-gradient(180deg,#f4f7ff,#eff3fd);border-radius:16px;padding:18px 20px;margin-bottom:10px}
.nook-thread .ic{width:42px;height:42px;border-radius:50%;background:#fff;color:var(--nb2);display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 1px 3px rgba(61,107,253,.12)}
.nook-thread .tt{font-weight:600;font-size:15px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.nook-thread .st{color:var(--ns);margin-top:3px}
.nook-paper{background:var(--paper);border-radius:16px;padding:22px 26px 18px;margin-bottom:14px;box-shadow:0 1px 0 #f1e8d8 inset}
.nook-paper .tt{font-size:17px;font-weight:650;margin-bottom:8px}
.nook-paper .bd{color:#3a3f4b;line-height:1.85}
.nook-paper .fl{border-top:1px solid #efe5d3;margin-top:14px;padding-top:12px;color:var(--nb2);display:flex;gap:8px}
.nook-paper .fl:before{content:"\\201C";font-size:22px;line-height:1;color:#7d9bff;font-family:Georgia,serif}
.nook-item{padding:16px 0;border-bottom:1px solid var(--nl)}
.nook-item:first-of-type{padding-top:4px}
.nook-item .tx{font-size:15px;font-weight:550;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.nook-item .mt{display:flex;justify-content:space-between;align-items:center;gap:10px;color:var(--nm);font-size:12.5px;margin-top:4px}
.nook-item .acts{display:flex;gap:8px;flex:none}
.nook-pill{font-size:11.5px;font-weight:500;border-radius:999px;padding:1px 9px;background:#f2f4f8;color:var(--ns)}
.nook-pill.confirmed,.nook-pill.blue{background:var(--nbs);color:var(--nb2)}
.nook-pill.inferred{background:#fdf3e2;color:#b7791f}
.nook-gone{background:#f6f7f9;border-radius:14px;padding:16px 18px;margin-bottom:10px}
.nook-gone .tx{text-decoration:line-through;color:var(--ns);font-weight:550}
.nook-gone .why{color:var(--ns);margin-top:4px}
.nook-foot{font-size:12.5px;color:var(--nm);margin-top:6px}
.nook-group{font-size:12px;color:var(--nm);margin:14px 0 2px;letter-spacing:.02em}
.nook-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;align-items:start}
.nook-list{max-width:760px;display:flex;flex-direction:column;gap:18px}
.nook-card{background:#fff;border:1px solid var(--nl);border-radius:20px;padding:20px 22px;box-shadow:0 2px 10px rgba(80,60,30,.04)}
.nook-card h3{margin:0 0 12px;font-size:16px;font-weight:650}
.nook-empty{color:var(--nm);font-size:13.5px}
.nook-row{padding:10px 0;border-bottom:1px solid var(--nl)}
.nook-row:last-child{border-bottom:none}
.nook-meta{font-size:12.5px;color:var(--nm);display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px}
.nook-tag{font-size:11.5px;border-radius:999px;padding:1px 9px;background:#f2f4f8;color:var(--ns)}
.nook-bar{height:6px;border-radius:3px;background:#eef1f7;overflow:hidden;margin-top:6px}
.nook-bar i{display:block;height:100%;background:linear-gradient(90deg,#7d9bff,#3d6bfd);border-radius:3px}
.nook-stage{display:flex;align-items:center;margin-top:10px}
.nook-stage .d{width:10px;height:10px;border-radius:50%;background:#e3e8f3;flex:none}
.nook-stage .d.on{background:var(--nb);box-shadow:0 0 0 3px #e3eaff}
.nook-stage .l{flex:1;height:2px;background:#e3e8f3}
.nook-stage .l.on{background:var(--nb)}
.nook-stagen{display:flex;justify-content:space-between;font-size:12px;color:var(--nm);margin-top:6px}
.nook-stagen .c{color:var(--nb2);font-weight:600}
.nook-chip{display:inline-block;font-size:12.5px;background:#f4f6fa;color:var(--ns);border-radius:999px;padding:3px 12px;margin:0 6px 8px 0}
.nook-field>span:first-child{white-space:nowrap}
.nook-field{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--nl);font-size:14px}
.nook-field:last-child{border-bottom:none}
.nook-hint{font-size:12.5px;color:var(--nm)}
.nook-input{border:1px solid #dfe5f2;border-radius:10px;padding:7px 12px;font-size:13.5px;min-width:140px;background:#fff;color:var(--nt);outline:none}
.nook-input:focus{border-color:#9db3ff;box-shadow:0 0 0 3px #eef2ff}
.nook-seg{display:inline-flex;background:#f3f5f9;border-radius:999px;padding:3px}
.nook-seg button{white-space:nowrap;border:none;background:none;padding:5px 14px;font-size:13px;cursor:pointer;color:var(--ns);border-radius:999px}
.nook-seg button.on{background:#fff;color:var(--nt);font-weight:600;box-shadow:0 1px 3px rgba(24,32,46,.12)}
.nook-onb{max-width:480px;margin:72px auto;background:#fff;border:1px solid var(--nl);border-radius:22px;padding:34px 36px 30px;box-shadow:0 12px 40px rgba(24,32,46,.06)}
.nook-onb h2{margin:0 0 6px;font-size:22px;font-weight:650}
.nook-msg{font-size:12.5px;color:var(--nb2);margin-top:8px}
.nook-a{color:var(--nt);text-decoration:none;font-weight:550}
.nook-a:hover{color:var(--nb2)}
.nook-head{gap:22px;margin-bottom:26px}
.nook-av{width:76px;height:76px;font-size:30px}
.nook-name{font-size:36px;font-weight:700;letter-spacing:-.02em}
.nook-tabs{gap:34px;margin-bottom:34px}
.nook-tab{font-size:16.5px;padding:10px 0 14px}
.nook-tab.on{font-weight:700}
.nook-sec{margin-bottom:44px}
.nook-sec>h3{font-size:24px;font-weight:700;margin-bottom:18px}
.nook-thread .tt{font-size:17.5px;font-weight:650}
.nook-thread .st{font-size:15px}
.nook-paper{padding:26px 30px 22px}
.nook-paper .tt{font-size:22px;font-weight:700;margin-bottom:10px;letter-spacing:-.01em}
.nook-paper .bd{font-size:15.5px}
.nook-paper .fl{font-size:15px}
.nook-item .tx{font-size:16px}
.nook-group{font-size:12.5px;font-weight:600;color:#8d867c;margin-top:18px}
.nook-card h3{font-size:18px;font-weight:700;margin-bottom:14px}
.nook-card .big{font-size:26px;font-weight:700;color:var(--nb2);letter-spacing:-.01em;line-height:1.3}
.nook-mbti{display:inline-block;font-size:28px;font-weight:800;letter-spacing:.08em;color:var(--nb2);margin:-4px 0 12px}
.nook-flip .front .t{font-size:14.5px}
.nook-drawer h4{font-size:14px;font-weight:700;color:var(--nt);margin:24px 0 6px}
@media (max-width:900px){.nook-cols{grid-template-columns:1fr}.nook-col+.nook-col{border-left:none;padding-left:0;margin-left:0}.nook-wrap{padding:24px}}
`;

		function useNook() {
			const [view, setView] = useState(undefined);
			const [error, setError] = useState("");
			const load = useCallback(() => fetch(`${API}/view`, { headers: { accept: "application/json" } })
				.then((r) => r.json())
				.then((d) => {
					if (!d.ok) throw new Error(d.error || "读取失败");
					setView(d.view);
					if (d.view?.companion?.name) companionName = d.view.companion.name;
					setError("");
				})
				.catch((e) => setError(String(e.message || e))), []);
			useEffect(() => {
				load();
				const t = setInterval(load, 15000);
				return () => clearInterval(t);
			}, [load]);
			const post = useCallback((path, body) => fetch(`${API}${path}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			}).then((r) => r.json()).then((d) => {
				if (!d.ok) throw new Error(d.error || "操作失败");
				return load().then(() => d);
			}), [load]);
			return { view, error, post, reload: load };
		}

		const ago = (at) => {
			const ms = Date.now() - at;
			if (ms < 120000) return "刚刚";
			if (ms < 3600000) return `${Math.round(ms / 60000)} 分钟前`;
			if (ms < 86400000) return `${Math.round(ms / 3600000)} 小时前`;
			return `${Math.round(ms / 86400000)} 天前`;
		};

		/** One plain sentence under her name: how she is and where you two are. */
		function headline(view) {
			const stage = view.bond.stages[Math.min(view.bond.stage, view.bond.stages.length - 1)];
			const where = view.companion.relation === "lover" ? `你们在「${stage}」阶段` : stage === "认识" ? "你们刚认识" : `你们是${stage === "聊得来" ? "聊得来的朋友" : stage}`;
			const how = view.asleep ? "她在睡觉" : `她现在${view.mood.label}`;
			return `${how} · ${where}`;
		}

		/** Her avatar: the picture the user uploaded, else the default, else her initial. */
		function Avatar({ view, size }) {
			const [src, setSrc] = useState(0);
			const sources = [
				view.companion && view.companion.avatar ? `${API}/avatar?v=${view.companion.avatar.at}` : null,
				`${API}/asset/avatar_default.png`,
			].filter(Boolean);
			const s = size || 52;
			if (src >= sources.length) return h("div", { className: "nook-av", style: { width: s, height: s, fontSize: s * 0.42 } }, (view.companion?.name || "N").slice(0, 1));
			return h("img", { className: "nook-av nook-avimg", style: { width: s, height: s }, src: sources[src], alt: "", onError: () => setSrc(src + 1) });
		}

		/** Pick an image file and upload it as her avatar. */
		function AvatarUpload({ onDone, label }) {
			const [msg, setMsg] = useState("");
			const pick = (e) => {
				const file = e.target.files && e.target.files[0];
				e.target.value = "";
				if (!file) return;
				if (file.size > 3 * 1024 * 1024) return setMsg("图片太大了，最大 3MB");
				const reader = new FileReader();
				reader.onload = () => fetch(`${API}/avatar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dataUrl: reader.result }) })
					.then((r) => r.json())
					.then((d) => {
						if (!d.ok) throw new Error(d.error || "上传失败");
						setMsg("");
						onDone && onDone();
					})
					.catch((err) => setMsg(String(err.message || err)));
				reader.readAsDataURL(file);
			};
			return h("span", null,
				h("label", { className: "nook-btn", style: { display: "inline-block" } }, label || "上传头像",
					h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", style: { display: "none" }, onChange: pick })),
				msg && h("span", { className: "nook-msg", style: { marginLeft: 8 } }, msg));
		}

		function NookIcon({ size }) {
			const s = size || 16;
			return h("svg", { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" },
				h("path", { d: "M4 11.5 12 5l8 6.5" }),
				h("path", { d: "M6 10v9h12v-9" }),
				h("path", { d: "M10 15.2c.6.8 1.3 1.2 2 1.2s1.4-.4 2-1.2" }));
		}

		function Onboarding({ post }) {
			const [name, setName] = useState("");
			const [relation, setRelation] = useState("friend");
			const [mbti, setMbti] = useState("");
			const [busy, setBusy] = useState(false);
			const [msg, setMsg] = useState("");
			const types = ["", "ENFP", "ENFJ", "ENTP", "ENTJ", "ESFP", "ESFJ", "ESTP", "ESTJ", "INFP", "INFJ", "INTP", "INTJ", "ISFP", "ISFJ", "ISTP", "ISTJ"];
			const submit = () => {
				setBusy(true);
				post("/setup", { name: name.trim() || "大D老师", relation, mbti: mbti || undefined })
					.catch((e) => setMsg(String(e.message || e)))
					.finally(() => setBusy(false));
			};
			return h("div", { className: "nook-onb" },
				h("h2", null, "创建你的伙伴"),
				h("div", { className: "nook-field" }, h("span", null, "名字"),
					h("input", { className: "nook-input", value: name, placeholder: "不填就叫 大D老师", maxLength: 12, onChange: (e) => setName(e.target.value) })),
				h("div", { className: "nook-field" }, h("span", null, "关系"), h(Seg, { value: relation, options: { friend: "朋友", lover: "恋人" }, onChange: setRelation })),
				h("div", { className: "nook-field" }, h("span", null, "性格"),
					h("select", { className: "nook-input", value: mbti, onChange: (e) => setMbti(e.target.value) },
						types.map((t) => h("option", { key: t || "self", value: t }, t || "让她自己来")))),
				h("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 18 } },
					h("button", { className: "nook-btn pri", disabled: busy, onClick: submit }, "开始")),
				msg && h("div", { className: "nook-msg" }, msg));
		}

		function Seg({ value, options, onChange }) {
			return h("div", { className: "nook-seg" }, Object.entries(options).map(([k, label]) =>
				h("button", { key: k, className: value === k ? "on" : "", onClick: () => onChange(k) }, label)));
		}

		function MemoryTab({ view, post }) {
			const live = view.memories.filter((m) => m.status === "active" && m.source !== "self");
			const promises = live.filter((m) => m.type === "promise" && !m.done);
			const about = live.filter((m) => m.type !== "promise" && m.type !== "moment");
			const moments = live.filter((m) => m.type === "moment");
			const open = view.threads.filter((t) => t.owner === "user" && t.status === "open");
			const sealed = view.memories.filter((m) => m.status === "sealed");
			const gone = view.memories.filter((m) => m.status === "invalid").slice(0, 6);
			const act = (action, m) => post("/memory", { action, id: m.id, text: m.text });
			const byArea = {};
			for (const m of about) (byArea[m.area || "other"] ??= []).push(m);
			return h("div", { className: "nook-cols" },
				h("div", { className: "nook-col" },
					h("div", { className: "nook-sec" }, h(Title, { spot: "spot_thread" }, "进行中"),
						open.length ? open.map((t) => h("div", { key: t.id, className: "nook-thread" },
							h("div", { className: "ic" }, h(ThreadIcon)),
							h("div", null,
								h("div", { className: "tt" }, t.title),
								h("div", { className: "st" }, t.stage),
								h("div", { className: "nook-meta", style: { marginTop: 8 } }, `最近聊到 · ${ago(t.updatedAt)}`)))) : h("div", { className: "nook-empty" }, "暂时没有")),
					h("div", { className: "nook-sec" }, h(Title, { spot: "spot_timeline" }, "时间线"),
						view.days.length ? view.days.slice(0, 7).map((d) => h("div", { key: d.date },
							h("div", { className: "nook-cap" }, d.date),
							h("div", { className: "nook-paper" },
								h("div", { className: "tt" }, d.title),
								h("div", { className: "bd" }, d.summary),
								d.feeling && h("div", { className: "fl" }, d.feeling)))) : h("div", { className: "nook-empty" }, "还没有"))),
				h("div", { className: "nook-col" },
					h("div", { className: "nook-sec" }, h(Title, { spot: "spot_about" }, "关于你"),
						about.length ? Object.entries(byArea).map(([area, items]) => h("div", { key: area },
							h("div", { className: "nook-group" }, AREAS[area] || "其他"),
							items.map((m) => h(MemoryRow, { key: m.id, m, act })))) : h("div", { className: "nook-empty", style: { textAlign: "center" } }, h(Spot, { name: "spot_empty", big: true }), "她还在认识你。")),
					promises.length > 0 && h("div", { className: "nook-sec" }, h(Title, { spot: "spot_promise" }, "约定"),
						promises.map((m) => h(MemoryRow, { key: m.id, m, act }))),
					moments.length > 0 && h("div", { className: "nook-sec" }, h(Title, { spot: "spot_bond" }, "我们的回忆"),
						h("div", { className: "nook-cards" }, moments.map((m, i) => h(MomentCard, { key: m.id, m, index: i, days: view.days })))),
					(gone.length > 0 || sealed.length > 0) && h("div", { className: "nook-sec" }, h(Title, { spot: "spot_gone" }, "不再成立"),
						gone.map((m) => h("div", { key: m.id, className: "nook-gone" },
							h("div", { className: "tx" }, m.text),
							m.invalidReason && h("div", { className: "why" }, m.invalidReason))),
						sealed.map((m) => h("div", { key: m.id, className: "nook-gone" },
							h("div", { className: "tx", style: { textDecoration: "none" } }, m.text),
							h("div", { className: "why" }, "你说过不想提，她不会主动提起。", h("button", { className: "nook-link", style: { marginLeft: 8 }, onClick: () => act("forget", m) }, "删掉")))))));
		}

		/** A small illustration shipped in assets/; hides itself if the file is missing. */
		function Spot({ name, big }) {
			const [gone, setGone] = useState(false);
			if (gone) return null;
			return h("img", { className: big ? "nook-spotbig" : "nook-spot", src: `${API}/asset/${name}.png`, alt: "", onError: () => setGone(true) });
		}

		const SCENES = ["idle", "reading", "miss", "sleep"];
		/**
		 * The window-side scene, showing what she is up to. All versions stay
		 * mounted in one box and cross-fade, so a change never jumps.
		 */
		function Scene({ scene }) {
			const [broken, setBroken] = useState({});
			return h("div", { className: "nook-scene" }, SCENES.map((k) => broken[k] ? null : h("img", {
				key: k,
				src: `${API}/asset/scene_${k}.png`,
				alt: "",
				style: { opacity: k === scene ? 1 : 0 },
				onError: () => setBroken((b) => ({ ...b, [k]: true })),
			})));
		}

		const CARD_ART = ["spot_promise", "spot_timeline", "spot_about", "spot_reading", "spot_bond", "spot_growth"];
		/** A shared moment as a card: picture on the front, what was said on the back. */
		function MomentCard({ m, index, days }) {
			const [open, setOpen] = useState(false);
			const [lines, setLines] = useState(undefined);
			const date = new Date(m.createdAt);
			const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
			const day = days.find((d) => d.date === key);
			const flip = () => {
				setOpen(!open);
				if (lines === undefined && m.evidence && m.evidence.length) {
					fetch(`${API}/evidence?ids=${encodeURIComponent(m.evidence.join(","))}`).then((r) => r.json())
						.then((d) => setLines((d.events || []).filter((e) => e.kind === "chat.user" && e.text)))
						.catch(() => setLines([]));
				}
			};
			return h("div", { className: `nook-flip ${open ? "on" : ""}`, onClick: flip },
				h("div", { className: "in" },
					h("div", { className: "fc front" },
						h("img", { src: `${API}/asset/${CARD_ART[index % CARD_ART.length]}.png`, alt: "" }),
						h("div", { className: "t" }, m.text.length > 34 ? `${m.text.slice(0, 33)}…` : m.text),
						h("div", { className: "d" }, `${date.getMonth() + 1} 月 ${date.getDate()} 日`)),
					h("div", { className: "fc back" },
						h("div", null, m.text),
						(lines || []).slice(0, 2).map((e) => h("div", { key: e.id, className: "q" }, e.text.length > 60 ? `${e.text.slice(0, 59)}…` : e.text)),
						day && h("div", { className: "nook-hint", style: { marginTop: 8 } }, `那天的卡片：${day.title}`))));
		}

		/** Section title with its illustration. */
		function Title({ spot, children }) {
			return h("h3", null, spot && h(Spot, { name: spot }), children);
		}

		function ThreadIcon() {
			return h("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" },
				h("path", { d: "M4 20V9l8-5 8 5v11" }), h("path", { d: "M9 20v-6h6v6" }));
		}

		function MemoryRow({ m, act }) {
			const [editing, setEditing] = useState(false);
			const [text, setText] = useState(m.text);
			const was = m.history && m.history.length ? m.history[m.history.length - 1].text : "";
			return h("div", { className: "nook-item" },
				editing
					? h("div", { style: { display: "flex", gap: 8 } },
						h("input", { className: "nook-input", style: { flex: 1 }, value: text, onChange: (e) => setText(e.target.value) }),
						h("button", { className: "nook-btn", onClick: () => act("correct", { ...m, text }).then(() => setEditing(false)) }, "保存"))
					: h("div", { className: "tx" }, m.text, h("span", { className: `nook-pill ${m.source}` }, SOURCE[m.source] || m.source)),
				h("div", { className: "mt" },
					h("span", null, was ? `以前：${was}` : `${ago(m.createdAt)}记下`),
					h("span", { className: "acts" },
						h("button", { className: "nook-link", onClick: () => setEditing(!editing) }, editing ? "取消" : "修改"),
						"·",
						h("button", { className: "nook-link", onClick: () => act("forget", m) }, "忘掉"))));
		}

		function StatusTab({ view, post }) {
			const stages = view.bond.stages;
			const stage = Math.min(view.bond.stage, stages.length - 1);
			return h("div", { className: "nook-grid" },
				h("div", { className: "nook-card" }, h(Title, { spot: view.asleep ? "spot_sleep" : "spot_mood" }, "此刻"),
					h("div", { className: "big" }, view.asleep ? "在睡觉" : view.mood.label),
					view.mood.reason && h("div", { className: "nook-hint" }, `因为${view.mood.reason}`),),
				h("div", { className: "nook-card" }, h(Title, { spot: "spot_bond" }, "你们的关系"),
					h("div", null, `${view.companion.relation === "lover" ? "恋人" : "朋友"} · `, h("b", { style: { color: "#2f55e0" } }, stages[stage])),
					h("div", { className: "nook-stage" }, stages.flatMap((s, i) => {
						const parts = [h("span", { key: `d${i}`, className: `d ${i <= stage ? "on" : ""}` })];
						if (i < stages.length - 1) parts.push(h("span", { key: `l${i}`, className: `l ${i < stage ? "on" : ""}` }));
						return parts;
					})),
					h("div", { className: "nook-stagen" }, stages.map((s, i) => h("span", { key: s, className: i === stage ? "c" : "" }, s))),
					view.bond.hurt && h("div", { className: "nook-hint", style: { marginTop: 8 } }, `心里还有点疙瘩：${view.bond.hurt}`),
					view.bond.changes.length > 0 && h("div", { style: { marginTop: 10 } },
						h("div", { className: "nook-hint" }, "最近的变化"),
						view.bond.changes.map((c, i) => h("div", { key: i, className: "nook-row" },
							h("span", { className: "nook-tag", style: { marginRight: 6 } }, c.sign > 0 ? "更亲近" : c.forgiven ? "已和好" : "有点疙瘩"), c.reason)))),
				h("div", { className: "nook-card" }, h("h3", null, "性格"),
					h("div", { className: "nook-mbti" }, view.mbti),
					Object.entries(TRAITS).map(([k, label]) => h("div", { key: k, style: { marginBottom: 6 } },
						h("div", { className: "nook-meta", style: { justifyContent: "space-between" } }, h("span", null, label), h("span", null, view.traits[k].toFixed(2))),
						h("div", { className: "nook-bar" }, h("i", { style: { width: `${Math.round(view.traits[k] * 100)}%` } }))))),
				h("div", { className: "nook-card" }, h(Title, { spot: "spot_growth" }, "成长记录"),
					view.growth.length ? view.growth.map((g) => h("div", { key: g.id, className: "nook-row" },
						g.changes.map((c, i) => h("div", { key: i }, `${TRAITS[c.trait]} ${c.to > c.from ? "多了一点" : "少了一点"}：${c.note || c.because}`)),
						h("div", { className: "nook-meta" }, new Date(g.at).toLocaleDateString(),
							g.undone ? h("span", null, "已撤销") : h("button", { className: "nook-link", onClick: () => post("/growth/undo", { id: g.id }) }, "撤销")))) : h("div", { className: "nook-empty" }, "还没有变化")),
				h("div", { className: "nook-card" }, h("h3", null, "口头禅和兴趣"),
					h("div", { className: "nook-hint" }, "口头禅"),
					view.catchphrases.length ? h("div", null, view.catchphrases.map((c) => h("span", { key: c.text, className: "nook-chip" }, `${c.text}${c.origin === "user" ? "（跟你学的）" : ""}`))) : h("div", { className: "nook-empty" }, "还没有"),
					h("div", { className: "nook-hint", style: { marginTop: 8 } }, "最近感兴趣的"),
					h("div", null, view.interests.map((i) => h("span", { key: i.topic, className: "nook-chip" }, i.topic)))),
				h("div", { className: "nook-card" }, h("h3", null, "她对你的了解"),
					Object.entries(AREAS).map(([k, label]) => h("div", { key: k, className: "nook-field" }, h("span", null, label),
						h("span", { className: "nook-hint" }, KNOW_LEVELS[view.know[k] || 0])))));
		}

		function ReadingTab({ view }) {
			const label = { ok: "读了", failed: "没搜到", withdrawn: "已撤回" };
			return h("div", { className: "nook-card" }, h(Title, { spot: "spot_reading" }, "她自己读的"),
				view.notes.length ? view.notes.map((n) => h("div", { key: n.id, className: "nook-row" },
					n.kind === "chat"
						? h("div", null, `聊天时查了「${n.query}」`)
						: n.status === "failed"
							? h("div", null, `想查「${n.query}」，没搜到靠谱的`)
							: h("div", null, h("a", { className: "nook-a", href: n.url, target: "_blank", rel: "noreferrer" }, n.title)),
					n.takeaway && h("div", { className: "nook-hint" }, n.takeaway),
					h("div", { className: "nook-meta" }, h("span", { className: "nook-tag" }, label[n.status] || n.status), ago(n.at), n.shared && h("span", null, "· 分享给你了")))) : h("div", { className: "nook-empty", style: { textAlign: "center" } }, h(Spot, { name: "spot_empty", big: true }), "还没有"));
		}

		function SettingsTab({ view, post, reload }) {
			const s = view.settings;
			const [name, setName] = useState(view.companion.name);
			const set = (patch) => post("/settings", patch);
			return h("div", { className: "nook-list" },
				h("div", { className: "nook-card" }, h(Title, { spot: "spot_settings" }, "基本信息"),
					h("div", { className: "nook-field" }, h("span", { style: { display: "flex", alignItems: "center", gap: 10 } }, h(Avatar, { view, size: 40 }), "头像"),
						h(AvatarUpload, { onDone: reload, label: "换一张" })),
					h("div", { className: "nook-field" }, h("span", null, "名字"),
						h("span", { style: { display: "flex", gap: 6 } },
							h("input", { className: "nook-input", value: name, maxLength: 12, onChange: (e) => setName(e.target.value) }),
							h("button", { className: "nook-btn", onClick: () => set({ name }) }, "保存"))),
					h("div", { className: "nook-field" }, h("span", null, "关系"), h(Seg, { value: view.companion.relation, options: { friend: "朋友", lover: "恋人" }, onChange: (v) => set({ relation: v }) }))),
				h("div", { className: "nook-card" }, h("h3", null, "主动消息"),
					h("div", { className: "nook-field" }, h("span", null, "主动消息频率"), h(Seg, { value: s.outreach, options: OUTREACH, onChange: (v) => set({ outreach: v }) })),
					h("div", { className: "nook-field" }, h("span", null, "作息时间"),
						h("span", { style: { display: "flex", gap: 6, alignItems: "center" } },
							h("input", { className: "nook-input", style: { minWidth: 70, width: 70 }, defaultValue: s.sleep.start, onBlur: (e) => set({ sleep: { start: e.target.value, end: s.sleep.end } }) }),
							"–",
							h("input", { className: "nook-input", style: { minWidth: 70, width: 70 }, defaultValue: s.sleep.end, onBlur: (e) => set({ sleep: { start: s.sleep.start, end: e.target.value } }) }))),
					h("div", { className: "nook-field" }, h("span", null, "工作时不打扰"),
						h(Seg, { value: s.respectWork ? "on" : "off", options: { on: "开", off: "关" }, onChange: (v) => set({ respectWork: v === "on" }) }))),
				h("div", { className: "nook-card" }, h("h3", null, "她自己的时间"),
					h("div", { className: "nook-field" }, h("span", null, "自己去网上看东西"),
						h(Seg, { value: s.explore ? "on" : "off", options: { on: "开", off: "关" }, onChange: (v) => set({ explore: v === "on" }) })),
					h("div", { className: "nook-field" }, h("span", null, "暂停"),
						h(Seg, { value: s.enabled ? "on" : "off", options: { on: "运行", off: "暂停" }, onChange: (v) => set({ enabled: v === "on" }) }))));
		}

		function NookPage({ openChat }) {
			const { view, error, post, reload } = useNook();
			const [tab, setTab] = useState("memory");
			const [opening, setOpening] = useState(false);
			let body;
			if (view === undefined) body = h("div", { className: "nook-wrap nook-empty" }, error || "读取中…");
			else if (!view.ready) body = h(Onboarding, { post });
			else {
				const tabs = { memory: "记忆", status: "状态", reading: "她读的", settings: "设置" };
				const Tab = { memory: MemoryTab, status: StatusTab, reading: ReadingTab, settings: SettingsTab }[tab];
				body = h("div", { className: "nook-wrap" },
					h("div", { className: "nook-head" },
						h(Scene, { scene: view.scene }),
						h(Avatar, { view }),
						h("div", { style: { flex: 1 } },
							h("div", { className: "nook-name" }, view.companion.name)),
						h("button", { className: "nook-btn pri", disabled: opening, onClick: () => { setOpening(true); openChat(view.sessions); setTimeout(() => setOpening(false), 1500); } }, `和${view.companion.name}聊天`)),
					h("div", { className: "nook-tabs" }, Object.entries(tabs).map(([k, label]) =>
						h("button", { key: k, className: `nook-tab ${tab === k ? "on" : ""}`, onClick: () => setTab(k) }, label))),
					h(Tab, { view, post, reload }));
			}
			return h("div", { className: "nook" }, h("style", null, CSS), body);
		}

		/* ---------------------------------------------------- chat drawer */

		const drawer = { sessionId: undefined, listeners: new Set() };
		const setDrawer = (id) => {
			drawer.sessionId = id;
			for (const l of drawer.listeners) l(id);
		};
		function useDrawer() {
			const [id, setId] = useState(drawer.sessionId);
			useEffect(() => {
				drawer.listeners.add(setId);
				return () => drawer.listeners.delete(setId);
			}, []);
			return id;
		}

		let nookSessions;
		const loadNookSessions = () => (nookSessions ??= fetch(`${API}/view`).then((r) => r.json()).then((d) => new Set(d.view?.sessions || [])).catch(() => new Set()));

		/** "她记得" in the header of Nook conversations. */
		function DrawerButton({ sessionId }) {
			const [show, setShow] = useState(false);
			useEffect(() => {
				nookSessions = undefined;
				loadNookSessions().then((set) => setShow(set.has(sessionId)));
			}, [sessionId]);
			if (!show) return null;
			return h("button", { className: "nook-pin", onClick: () => setDrawer(sessionId), title: "她记得的、和这段对话有关的事" },
				h("img", { src: `${API}/asset/spot_about.png`, alt: "" }), "她记得");
		}

		/** The drawer itself, mounted once as an overlay. */
		function Drawer() {
			const sessionId = useDrawer();
			const [data, setData] = useState(undefined);
			const load = useCallback(() => {
				if (!sessionId) return;
				Promise.all([
					fetch(`${API}/related?sessionId=${encodeURIComponent(sessionId)}`).then((r) => r.json()),
					fetch(`${API}/view`).then((r) => r.json()),
				]).then(([rel, v]) => setData({ ...rel.related, view: v.view })).catch(() => setData(null));
			}, [sessionId]);
			useEffect(() => {
				setData(undefined);
				load();
			}, [load]);
			if (!sessionId) return null;
			const act = (action, m) => fetch(`${API}/memory`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, id: m.id, text: m.text }) }).then(load);
			return h("div", { className: "nook-ov" },
				h("style", null, CSS),
				h("div", { className: "nook-drawer-mask", onClick: () => setDrawer(undefined) }),
				h("div", { className: "nook-drawer" },
					data === undefined ? h("div", { className: "nook-empty" }, "读取中…") : data === null ? h("div", { className: "nook-empty" }, "读不到她的记忆") : [
						h("div", { key: "h", style: { display: "flex", alignItems: "center", gap: 12 } },
							h(Avatar, { view: data.view, size: 44 }),
							h("div", { style: { flex: 1 } }, h("div", { style: { fontWeight: 650, fontSize: 17 } }, data.view.companion.name),
								h("div", { className: "nook-hint" }, data.view.asleep ? "在睡觉" : data.mood.label)),
							h("button", { className: "nook-link", onClick: () => setDrawer(undefined) }, "关闭")),
						h("h4", { key: "t" }, "你们正在经历的"),
						data.threads.length ? data.threads.map((t) => h("div", { key: t.id, className: "nook-item" }, h("div", { className: "tx" }, t.title), h("div", { className: "mt" }, t.stage))) : h("div", { key: "te", className: "nook-empty" }, "暂时没有"),
						h("h4", { key: "m" }, "和这段对话有关的"),
						data.memories.length ? data.memories.map((m) => h(MemoryRow, { key: m.id, m, act })) : h("div", { key: "me", className: "nook-empty" }, "暂时没有"),
						!data.memories.length && data.recent.length > 0 && h("h4", { key: "r" }, "她最近记下的"),
						!data.memories.length && data.recent.map((m) => h(MemoryRow, { key: m.id, m, act })),
					]));
		}

		/** Her name for the sidebar entry, refreshed whenever the page loads her state. */
		let companionName = "大D老师";
		fetch(`${API}/view`).then((r) => r.json()).then((d) => { if (d.view?.companion?.name) companionName = d.view.companion.name; }).catch(() => {});

		const inject = ["slots"];

		function apply(ctx) {
			// Open her most recent conversation, or start one with the Nook preset.
			const openChat = (sessions) => {
				const ui = ctx.get ? ctx.get("uiWorkspace") : ctx.uiWorkspace;
				if (!ui) return;
				const latest = (sessions || [])[0];
				if (latest) ui.openSession(latest);
				else ui.startSession(undefined, { agentPreset: "nook" });
			};
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: PANEL_ID,
				order: 5,
				label: () => companionName,
			}, NookIcon));
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
				name: "conversation.session.header.utilities",
				id: "nook-drawer",
				order: -10,
				inject: (sessionId) => ({ sessionId }),
			}, DrawerButton));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "nook-drawer",
				order: 40,
			}, Drawer));
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PANEL_ID,
				inject: () => ({ openChat }),
			}, NookPage));
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.NookPage = NookPage;
		return module.exports;
	},
});

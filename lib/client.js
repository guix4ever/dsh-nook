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

		/*
		 * Design system. Five sizes (30 / 20 / 15 / 15 semibold / 12.5); hierarchy
		 * from weight and three ink greys, not from size; blue only for things you
		 * can click; warmth from paper and a few illustrations.
		 */
		const CSS = `
.nook,.nook-ov{--ink1:#24211d;--ink2:#5c5750;--ink3:#9b958c;--line:#ece7df;--bg:#fbf9f5;--surface:#fff;--paper:#fcf6ea;--paperline:#efe4cf;--blue:#3d6bfd;--blue2:#2f55e0;--serif:"Songti SC","Noto Serif SC","Source Han Serif SC","STSong",serif;color:var(--ink1);font-size:15px;line-height:1.7;-webkit-font-smoothing:antialiased;font-family:-apple-system,"PingFang SC","HarmonyOS Sans SC","Noto Sans SC","Microsoft YaHei",sans-serif}
.nook{height:100%;overflow:auto;background:var(--bg)}
.nook *,.nook-ov *{box-sizing:border-box}
.nook-wrap{max-width:1080px;margin:0 auto;padding:40px 48px 72px}
.nook-narrow{max-width:720px}
.nook-head{position:relative;display:flex;align-items:center;gap:16px;min-height:112px;margin-bottom:8px}
.nook-name{font-size:30px;font-weight:600;letter-spacing:-.01em;line-height:1.25}
.nook-scene{position:absolute;right:170px;top:-40px;width:560px;height:168px;pointer-events:none}
.nook-scene img{position:absolute;right:0;top:0;height:168px;transition:opacity .2s ease}
.nook-av{border-radius:50%;background:#eef1f8;color:var(--ink2);display:flex;align-items:center;justify-content:center;font-weight:600;flex:none}
.nook-avimg{object-fit:cover;box-shadow:0 0 0 1px var(--line)}
.nook-btn{white-space:nowrap;border:1px solid var(--line);background:var(--surface);color:var(--ink1);border-radius:999px;padding:7px 16px;font-size:13.5px;cursor:pointer;transition:background .15s,border-color .15s}
.nook-btn:hover{border-color:#d9d2c6}
.nook-btn.pri{margin-left:auto;border:none;color:#fff;background:var(--blue);padding:10px 22px;font-size:15px;font-weight:500;box-shadow:0 1px 2px rgba(29,59,160,.2)}
.nook-btn.pri:hover{background:var(--blue2)}
.nook-btn:disabled{opacity:.5;cursor:default}
.nook-link{background:none;border:none;padding:0;color:var(--ink3);font-size:12.5px;cursor:pointer}
.nook-link:hover{color:var(--blue2)}
.nook-tabs{display:flex;gap:28px;border-bottom:1px solid var(--line);margin:0 0 36px}
.nook-tab{background:none;border:none;padding:10px 0 12px;font-size:15px;color:var(--ink3);cursor:pointer;position:relative}
.nook-tab:hover{color:var(--ink2)}
.nook-tab.on{color:var(--ink1);font-weight:600}
.nook-tab.on:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--blue);border-radius:2px}
.nook-h{font-size:15px;font-weight:600;color:var(--ink2);margin:0 0 14px;display:flex;align-items:baseline;gap:8px}
.nook-h .n{font-weight:400;color:var(--ink3);font-size:12.5px}
.nook-sec{margin-bottom:44px}
.nook-meta{font-size:12.5px;color:var(--ink3)}
.nook-empty{font-size:15px;color:var(--ink3)}
.nook-today{background:var(--paper);border-radius:18px;padding:28px 34px 24px;margin-bottom:44px;box-shadow:inset 0 0 0 1px var(--paperline)}
.nook-today .d{font-size:12.5px;color:#a7957a;margin-bottom:6px}
.nook-today .t{font-size:20px;font-weight:600;line-height:1.45;margin-bottom:10px}
.nook-today .b{font-family:var(--serif);font-size:15px;line-height:1.95;color:#3d3832}
.nook-today .f{font-family:var(--serif);color:var(--ink2);margin-top:14px;padding-top:12px;border-top:1px dashed var(--paperline)}
.nook-cols{display:grid;grid-template-columns:1fr 1fr;gap:64px}
.nook-row{padding:12px 0;border-bottom:1px solid var(--line)}
.nook-row:last-child{border-bottom:none}
.nook-row .p{font-weight:500}
.nook-row .s{color:var(--ink2)}
.nook-row .m{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:2px}
.nook-row .acts{display:flex;gap:10px;opacity:0;transition:opacity .15s}
.nook-row:hover .acts{opacity:1}
.nook-guess{font-size:11.5px;color:var(--ink3);border:1px dashed #cfc7ba;border-radius:4px;padding:0 5px;margin-left:8px;vertical-align:2px;font-weight:400}
.nook-group{font-size:12.5px;color:var(--ink3);margin:18px 0 0}
.nook-group:first-of-type{margin-top:0}
.nook-old{color:var(--ink3);text-decoration:line-through}
.nook-more{background:none;border:none;padding:6px 0;font-size:13.5px;color:var(--ink3);cursor:pointer}
.nook-more:hover{color:var(--blue2)}
.nook-day{display:flex;gap:16px;padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer}
.nook-day .dd{font-size:12.5px;color:var(--ink3);width:72px;flex:none;padding-top:2px}
.nook-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.nook-flip{perspective:900px;height:190px;cursor:pointer}
.nook-flip .in{position:relative;width:100%;height:100%;transition:transform .5s cubic-bezier(.3,.7,.3,1);transform-style:preserve-3d}
.nook-flip.on .in{transform:rotateY(180deg)}
.nook-flip .fc{position:absolute;inset:0;backface-visibility:hidden;border-radius:14px;padding:14px;overflow:hidden}
.nook-flip .front{background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);display:flex;flex-direction:column;align-items:center;text-align:center}
.nook-flip .front img{width:84px;height:84px;object-fit:contain;margin:2px 0 6px}
.nook-flip .front .t{font-size:13.5px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nook-flip .back{background:var(--paper);box-shadow:inset 0 0 0 1px var(--paperline);transform:rotateY(180deg);font-size:13.5px;line-height:1.7;overflow:auto;font-family:var(--serif)}
.nook-flip .back .q{color:var(--ink2);margin-top:8px}
.nook-mood{margin:0 0 44px}
.nook-mood .w{font-size:20px;font-weight:600;line-height:1.5}
.nook-mood .r{color:var(--ink2);margin-top:4px}
.nook-stage{display:flex;align-items:center;margin:4px 0 6px}
.nook-stage .d{width:8px;height:8px;border-radius:50%;background:#e2ddd4;flex:none}
.nook-stage .d.on{background:var(--ink1)}
.nook-stage .l{flex:1;height:1px;background:#e2ddd4}
.nook-stage .l.on{background:var(--ink1)}
.nook-stagen{display:flex;justify-content:space-between;font-size:12.5px;color:var(--ink3)}
.nook-stagen .c{color:var(--ink1);font-weight:600}
.nook-trait{display:grid;grid-template-columns:72px 1fr;align-items:center;gap:12px;padding:5px 0;font-size:13.5px;color:var(--ink2)}
.nook-trait .bar{height:4px;border-radius:2px;background:#ece7df;overflow:hidden}
.nook-trait .bar i{display:block;height:100%;background:var(--ink2);border-radius:2px}
.nook-badge{font-size:12.5px;color:var(--ink2);border:1px solid var(--line);border-radius:4px;padding:0 6px;letter-spacing:.04em;font-weight:500}
.nook-chip{display:inline-block;font-size:13.5px;color:var(--ink2);background:#f2eee7;border-radius:999px;padding:2px 12px;margin:0 6px 8px 0}
.nook-know{display:grid;grid-template-columns:1fr 1fr;gap:0 40px}
.nook-know .k{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line)}
.nook-dots{display:inline-flex;gap:4px;align-items:center}
.nook-dots i{width:6px;height:6px;border-radius:50%;background:#e2ddd4}
.nook-dots i.on{background:var(--ink2)}
.nook-read{padding:16px 0;border-bottom:1px solid var(--line)}
.nook-read a{color:var(--ink1);text-decoration:none;font-weight:500}
.nook-read a:hover{color:var(--blue2)}
.nook-read .tk{font-family:var(--serif);color:var(--ink2);margin-top:4px}
.nook-field{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}
.nook-field:last-child{border-bottom:none}
.nook-field>span:first-child{white-space:nowrap}
.nook-input{border:1px solid var(--line);border-radius:10px;padding:7px 12px;font-size:14px;min-width:140px;background:var(--surface);color:var(--ink1);outline:none}
.nook-input:focus{border-color:#9db3ff}
.nook-seg{display:inline-flex;background:#f0ece5;border-radius:999px;padding:3px}
.nook-seg button{white-space:nowrap;border:none;background:none;padding:4px 14px;font-size:13.5px;cursor:pointer;color:var(--ink2);border-radius:999px}
.nook-seg button.on{background:var(--surface);color:var(--ink1);font-weight:600;box-shadow:0 1px 2px rgba(36,33,29,.12)}
.nook-onb{max-width:460px;margin:80px auto;background:var(--surface);border-radius:22px;padding:34px 36px 30px;box-shadow:0 0 0 1px var(--line),0 16px 48px rgba(36,33,29,.06)}
.nook-onb .t{font-size:20px;font-weight:600;margin-bottom:12px}
.nook-msg{font-size:12.5px;color:var(--blue2);margin-top:8px}
.nook-spotbig{width:110px;height:110px;object-fit:contain;display:block;margin:4px 0 6px;opacity:.95}
.nook-pin{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:4px 12px;font-size:13px;color:var(--ink2);cursor:pointer}
.nook-pin:hover{color:var(--ink1);border-color:#d9d2c6}
.nook-drawer-mask{position:fixed;inset:0;background:rgba(36,33,29,.10);z-index:60}
.nook-drawer{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:92vw;background:var(--bg);box-shadow:-1px 0 0 var(--line),-16px 0 48px rgba(36,33,29,.08);z-index:61;overflow:auto;padding:24px 26px 40px;animation:nookslide .2s ease}
@keyframes nookslide{from{transform:translateX(20px);opacity:0}to{transform:none;opacity:1}}
.nook-drawer .nook-h{margin-top:28px}
@media (max-width:900px){.nook-cols,.nook-know{grid-template-columns:1fr}.nook-wrap{padding:24px}.nook-scene{display:none}}
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
				h("div", { className: "t" }, "创建你的伙伴"),
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

		const SCENES = ["idle", "reading", "miss", "sleep"];
		/** The window-side scene, showing what she is up to; versions cross-fade. */
		function Scene({ scene }) {
			const [broken, setBroken] = useState({});
			return h("div", { className: "nook-scene" }, SCENES.map((k) => broken[k] ? null : h("img", {
				key: k, src: `${API}/asset/scene_${k}.png`, alt: "",
				style: { opacity: k === scene ? 1 : 0 },
				onError: () => setBroken((b) => ({ ...b, [k]: true })),
			})));
		}

		/** A larger illustration for empty states; hides itself if missing. */
		function Spot({ name }) {
			const [gone, setGone] = useState(false);
			return gone ? null : h("img", { className: "nook-spotbig", src: `${API}/asset/${name}.png`, alt: "", onError: () => setGone(true) });
		}

		const dateOf = (at) => {
			const d = new Date(at);
			return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
		};
		const dayLabel = (key) => {
			const [, m, d] = key.split("-").map(Number);
			return `${m} 月 ${d} 日`;
		};

		const CARD_ART = ["spot_promise", "spot_timeline", "spot_about", "spot_reading", "spot_bond", "spot_growth", "spot_thread", "spot_mood"];
		/** A shared moment: picture on the front, what was said that day on the back. */
		function MomentCard({ m, index }) {
			const [open, setOpen] = useState(false);
			const [lines, setLines] = useState(undefined);
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
						h("div", { className: "t" }, m.text),
						h("div", { className: "nook-meta", style: { marginTop: "auto" } }, dateOf(m.createdAt))),
					h("div", { className: "fc back" },
						h("div", null, m.text),
						(lines || []).slice(0, 2).map((e) => h("div", { key: e.id, className: "q" }, `“${e.text}”`)))));
		}

		/** One remembered thing. Only guesses are marked; the default is "you said it". */
		function MemoryRow({ m, act }) {
			const [editing, setEditing] = useState(false);
			const [text, setText] = useState(m.text);
			const was = m.history && m.history.length ? m.history[m.history.length - 1].text : "";
			return h("div", { className: "nook-row" },
				editing
					? h("div", { style: { display: "flex", gap: 8 } },
						h("input", { className: "nook-input", style: { flex: 1 }, value: text, onChange: (e) => setText(e.target.value) }),
						h("button", { className: "nook-btn", onClick: () => act("correct", { ...m, text }).then(() => setEditing(false)) }, "保存"))
					: h("div", null, m.text, m.source === "inferred" && h("span", { className: "nook-guess" }, "推测")),
				h("div", { className: "m" },
					h("span", { className: "nook-meta" }, was ? `以前是：${was}` : ""),
					h("span", { className: "acts" },
						h("button", { className: "nook-link", onClick: () => setEditing(!editing) }, editing ? "取消" : "修改"),
						h("button", { className: "nook-link", onClick: () => act("forget", m) }, "忘掉"))));
		}

		function MemoryTab({ view, post }) {
			const [showGone, setShowGone] = useState(false);
			const [showDays, setShowDays] = useState(false);
			const live = view.memories.filter((m) => m.status === "active" && m.source !== "self");
			const promises = live.filter((m) => m.type === "promise" && !m.done);
			const about = live.filter((m) => m.type !== "promise" && m.type !== "moment");
			const moments = live.filter((m) => m.type === "moment");
			const open = view.threads.filter((t) => t.owner === "user" && t.status === "open");
			const gone = [...view.memories.filter((m) => m.status === "invalid"), ...view.memories.filter((m) => m.status === "sealed")];
			const act = (action, m) => post("/memory", { action, id: m.id, text: m.text });
			const byArea = {};
			for (const m of about) (byArea[m.area || "other"] ??= []).push(m);
			const [today, ...earlier] = view.days;
			return h("div", null,
				today ? h("div", { className: "nook-today" },
					h("div", { className: "d" }, dayLabel(today.date)),
					h("div", { className: "t" }, today.title),
					h("div", { className: "b" }, today.summary),
					today.feeling && h("div", { className: "f" }, today.feeling)) : null,
				h("div", { className: "nook-cols" },
					h("div", null,
						h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "进行中"),
							open.length ? open.map((t) => h("div", { key: t.id, className: "nook-row" },
								h("div", { className: "p" }, t.title),
								h("div", { className: "s" }, t.stage))) : h("div", { className: "nook-empty" }, "暂时没有")),
						moments.length > 0 && h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "我们的回忆"),
							h("div", { className: "nook-cards" }, moments.map((m, i) => h(MomentCard, { key: m.id, m, index: i })))),
						earlier.length > 0 && h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "更早"),
							(showDays ? earlier : earlier.slice(0, 4)).map((d) => h(DayRow, { key: d.date, d })),
							earlier.length > 4 && !showDays && h("button", { className: "nook-more", onClick: () => setShowDays(true) }, `再看 ${earlier.length - 4} 天`))),
					h("div", null,
						h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "关于你"),
							about.length ? Object.entries(byArea).map(([area, items]) => h("div", { key: area },
								h("div", { className: "nook-group" }, AREAS[area] || "其他"),
								items.map((m) => h(MemoryRow, { key: m.id, m, act })))) : h("div", null, h(Spot, { name: "spot_empty" }), h("div", { className: "nook-empty" }, "她还在认识你"))),
						promises.length > 0 && h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "约定"),
							promises.map((m) => h(MemoryRow, { key: m.id, m, act }))),
						gone.length > 0 && h("div", { className: "nook-sec" },
							h("button", { className: "nook-more", onClick: () => setShowGone(!showGone) }, showGone ? "收起" : `${gone.length} 条已经不成立`),
							showGone && gone.map((m) => h("div", { key: m.id, className: "nook-row" },
								h("div", { className: m.status === "sealed" ? "" : "nook-old" }, m.text),
								h("div", { className: "m" },
									h("span", { className: "nook-meta" }, m.status === "sealed" ? "不再提起" : (m.invalidReason || "")),
									h("span", { className: "acts" }, h("button", { className: "nook-link", onClick: () => act("forget", m) }, "删掉")))))))));
		}

		function DayRow({ d }) {
			const [open, setOpen] = useState(false);
			return h("div", { className: "nook-day", onClick: () => setOpen(!open) },
				h("div", { className: "dd" }, dayLabel(d.date)),
				h("div", null, h("div", { className: open ? "" : "p", style: { fontWeight: 500 } }, d.title),
					open && h("div", { style: { fontFamily: "var(--serif)", color: "var(--ink2)", marginTop: 4 } }, d.summary, d.feeling ? ` ${d.feeling}` : "")));
		}

		function StatusTab({ view, post }) {
			const stages = view.bond.stages;
			const stage = Math.min(view.bond.stage, stages.length - 1);
			return h("div", { className: "nook-narrow" },
				h("div", { className: "nook-mood" },
					h("div", { className: "w" }, view.asleep ? "在睡觉" : view.mood.label),
					!view.asleep && view.mood.reason && h("div", { className: "r" }, view.mood.reason)),
				h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "你们的关系", h("span", { className: "n" }, view.companion.relation === "lover" ? "恋人" : "朋友")),
					h("div", { className: "nook-stage" }, stages.flatMap((s, i) => {
						const parts = [h("span", { key: `d${i}`, className: `d ${i <= stage ? "on" : ""}` })];
						if (i < stages.length - 1) parts.push(h("span", { key: `l${i}`, className: `l ${i < stage ? "on" : ""}` }));
						return parts;
					})),
					h("div", { className: "nook-stagen" }, stages.map((s, i) => h("span", { key: s, className: i === stage ? "c" : "" }, s))),
					view.bond.changes.length > 0 && h("div", { style: { marginTop: 14 } }, view.bond.changes.slice(0, 4).map((c, i) => h("div", { key: i, className: "nook-row" },
						h("span", { className: "s" }, c.reason), h("span", { className: "nook-meta", style: { marginLeft: 8 } }, c.sign > 0 ? "更亲近了" : c.forgiven ? "和好了" : "有点疙瘩"))))),
				h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "性格", h("span", { className: "nook-badge" }, view.mbti)),
					Object.entries(TRAITS).map(([k, label]) => h("div", { key: k, className: "nook-trait" },
						h("span", null, label), h("div", { className: "bar" }, h("i", { style: { width: `${Math.round(view.traits[k] * 100)}%` } }))))),
				view.growth.length > 0 && h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "成长记录"),
					view.growth.map((g) => h("div", { key: g.id, className: "nook-row" },
						g.changes.map((c, i) => h("div", { key: i }, c.note || `${TRAITS[c.trait]}${c.to > c.from ? "多了一点" : "少了一点"}`)),
						h("div", { className: "m" }, h("span", { className: "nook-meta" }, dateOf(g.at)),
							g.undone ? h("span", { className: "nook-meta" }, "已撤销") : h("span", { className: "acts", style: { opacity: 1 } }, h("button", { className: "nook-link", onClick: () => post("/growth/undo", { id: g.id }) }, "撤销")))))),
				(view.catchphrases.length > 0 || view.interests.length > 0) && h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "口头禅和兴趣"),
					h("div", null, view.catchphrases.map((c) => h("span", { key: c.text, className: "nook-chip" }, `“${c.text}”`)), view.interests.map((i) => h("span", { key: i.topic, className: "nook-chip" }, i.topic)))),
				h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "她对你的了解"),
					h("div", { className: "nook-know" }, Object.entries(AREAS).map(([k, label]) => h("div", { key: k, className: "k" },
						h("span", null, label),
						h("span", { className: "nook-dots", title: KNOW_LEVELS[view.know[k] || 0] }, [1, 2, 3].map((n) => h("i", { key: n, className: (view.know[k] || 0) >= n ? "on" : "" }))))))));
		}

		function ReadingTab({ view }) {
			const notes = view.notes.filter((n) => n.status === "ok" && n.kind !== "chat");
			if (!notes.length) return h("div", { className: "nook-narrow" }, h(Spot, { name: "spot_reading" }), h("div", { className: "nook-empty" }, "还没有"));
			return h("div", { className: "nook-narrow" }, notes.map((n) => h("div", { key: n.id, className: "nook-read" },
				h("a", { href: n.url, target: "_blank", rel: "noreferrer" }, n.title),
				n.takeaway && h("div", { className: "tk" }, n.takeaway),
				h("div", { className: "nook-meta", style: { marginTop: 6 } }, `${ago(n.at)}${n.shared ? " · 分享给你了" : ""}`))));
		}

		function SettingsTab({ view, post, reload }) {
			const s = view.settings;
			const [name, setName] = useState(view.companion.name);
			const set = (patch) => post("/settings", patch);
			const onOff = (v) => (v ? "on" : "off");
			return h("div", { className: "nook-narrow" },
				h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "她"),
					h("div", { className: "nook-field" }, h("span", null, "头像"), h("span", { style: { display: "flex", alignItems: "center", gap: 12 } }, h(Avatar, { view, size: 36 }), h(AvatarUpload, { onDone: reload, label: "更换" }))),
					h("div", { className: "nook-field" }, h("span", null, "名字"),
						h("span", { style: { display: "flex", gap: 8 } }, h("input", { className: "nook-input", value: name, maxLength: 12, onChange: (e) => setName(e.target.value) }),
							name !== view.companion.name && h("button", { className: "nook-btn", onClick: () => set({ name }) }, "保存"))),
					h("div", { className: "nook-field" }, h("span", null, "关系"), h(Seg, { value: view.companion.relation, options: { friend: "朋友", lover: "恋人" }, onChange: (v) => set({ relation: v }) }))),
				h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "主动找你"),
					h("div", { className: "nook-field" }, h("span", null, "频率"), h(Seg, { value: s.outreach, options: OUTREACH, onChange: (v) => set({ outreach: v }) })),
					h("div", { className: "nook-field" }, h("span", null, "作息"),
						h("span", { style: { display: "flex", gap: 6, alignItems: "center" } },
							h("input", { className: "nook-input", style: { minWidth: 72, width: 72 }, defaultValue: s.sleep.start, onBlur: (e) => set({ sleep: { start: e.target.value, end: s.sleep.end } }) }),
							h("span", { className: "nook-meta" }, "到"),
							h("input", { className: "nook-input", style: { minWidth: 72, width: 72 }, defaultValue: s.sleep.end, onBlur: (e) => set({ sleep: { start: s.sleep.start, end: e.target.value } }) }))),
					h("div", { className: "nook-field" }, h("span", null, "你工作时不打扰"), h(Seg, { value: onOff(s.respectWork), options: { on: "开", off: "关" }, onChange: (v) => set({ respectWork: v === "on" }) }))),
				h("div", { className: "nook-sec" }, h("div", { className: "nook-h" }, "她自己的时间"),
					h("div", { className: "nook-field" }, h("span", null, "自己去网上看东西"), h(Seg, { value: onOff(s.explore), options: { on: "开", off: "关" }, onChange: (v) => set({ explore: v === "on" }) })),
					h("div", { className: "nook-field" }, h("span", null, "运行状态"), h(Seg, { value: onOff(s.enabled), options: { on: "运行", off: "暂停" }, onChange: (v) => set({ enabled: v === "on" }) }))));
		}

		function NookPage({ openChat }) {
			const { view, error, post, reload } = useNook();
			const [tab, setTab] = useState("memory");
			let body;
			if (view === undefined) body = h("div", { className: "nook-wrap nook-empty" }, error || "");
			else if (!view.ready) body = h(Onboarding, { post });
			else {
				const tabs = { memory: "记忆", status: "状态", reading: "她读的", settings: "设置" };
				const Tab = { memory: MemoryTab, status: StatusTab, reading: ReadingTab, settings: SettingsTab }[tab];
				body = h("div", { className: "nook-wrap" },
					h("div", { className: "nook-head" },
						h(Scene, { scene: view.scene }),
						h(Avatar, { view, size: 56 }),
						h("div", { className: "nook-name" }, view.companion.name),
						h("button", { className: "nook-btn pri", onClick: () => openChat(view.sessions) }, "去聊天")),
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
							h("div", { style: { flex: 1 } }, h("div", { style: { fontWeight: 600, fontSize: 20 } }, data.view.companion.name),
								h("div", { className: "nook-meta" }, data.view.asleep ? "在睡觉" : data.mood.label)),
							h("button", { className: "nook-link", onClick: () => setDrawer(undefined) }, "关闭")),
						h("div", { key: "t", className: "nook-h" }, "进行中"),
						data.threads.length ? data.threads.map((t) => h("div", { key: t.id, className: "nook-row" }, h("div", { className: "p" }, t.title), h("div", { className: "s" }, t.stage))) : h("div", { key: "te", className: "nook-empty" }, "暂时没有"),
						h("div", { key: "m", className: "nook-h" }, "和这段对话有关的"),
						data.memories.length ? data.memories.map((m) => h(MemoryRow, { key: m.id, m, act })) : h("div", { key: "me", className: "nook-empty" }, "暂时没有"),
						!data.memories.length && data.recent.length > 0 && h("div", { key: "r", className: "nook-h" }, "最近记下的"),
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

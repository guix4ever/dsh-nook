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
.nook{--nb:#3d6bfd;--nb2:#2f55e0;--nbs:#edf2ff;--nl:#e3e9f6;--nt:#1d2433;--ns:#5f6b85;--nm:#9aa3b5;height:100%;overflow:auto;background:#f6f8fd;color:var(--nt);font-size:14px;line-height:1.6}
.nook *{box-sizing:border-box}
.nook-wrap{max-width:1040px;margin:0 auto;padding:28px 32px 48px}
.nook-head{display:flex;align-items:center;gap:14px;margin-bottom:18px}
.nook-avimg{object-fit:cover;border:2px solid #fff;box-shadow:0 2px 8px rgba(61,107,253,.15)}
.nook-av{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#dbe6ff,#c3d4ff);color:#3556d6;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:600;flex:none}
.nook-name{font-size:20px;font-weight:600}
.nook-sub{font-size:13px;color:var(--ns)}
.nook-btn{border:1px solid #cdd9ff;background:#fff;color:var(--nb2);border-radius:10px;padding:7px 16px;font-size:13.5px;cursor:pointer}
.nook-btn.pri{background:var(--nb);border-color:var(--nb);color:#fff}
.nook-btn:disabled{opacity:.5;cursor:default}
.nook-link{color:var(--nb2);cursor:pointer;font-size:12.5px;background:none;border:none;padding:0}
.nook-tabs{display:flex;gap:6px;margin:4px 0 16px;flex-wrap:wrap}
.nook-tab{border:1px solid var(--nl);background:#fff;border-radius:999px;padding:5px 16px;font-size:13.5px;color:var(--ns);cursor:pointer}
.nook-tab.on{background:var(--nbs);border-color:#cdd9ff;color:var(--nb2);font-weight:600}
.nook-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.nook-card{background:#fff;border:1px solid var(--nl);border-radius:14px;padding:16px 18px}
.nook-card h3{margin:0 0 10px;font-size:14.5px;font-weight:600}
.nook-empty{color:var(--nm);font-size:13px}
.nook-row{padding:8px 0;border-bottom:1px solid #f0f3f9}
.nook-row:last-child{border-bottom:none}
.nook-meta{font-size:12px;color:var(--nm);display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px}
.nook-tag{font-size:11px;border-radius:4px;padding:0 6px;border:1px solid var(--nl);color:var(--ns)}
.nook-tag.confirmed{border-color:#cfdbff;color:var(--nb2);background:#f1f5ff}
.nook-tag.inferred{border-style:dashed}
.nook-old{color:var(--nm);text-decoration:line-through}
.nook-day{border-left:3px solid #c9d7ff;padding:4px 0 6px 12px;margin-bottom:12px}
.nook-day b{font-weight:600}
.nook-feel{color:#6d55d6;font-size:13px;margin-top:2px}
.nook-bar{height:6px;border-radius:3px;background:#e8edf8;overflow:hidden;margin-top:4px}
.nook-bar i{display:block;height:100%;background:var(--nb);border-radius:3px}
.nook-stage{display:flex;align-items:center;margin-top:8px}
.nook-stage .d{width:10px;height:10px;border-radius:50%;background:#dde4f5;flex:none}
.nook-stage .d.on{background:var(--nb)}
.nook-stage .l{flex:1;height:2px;background:#dde4f5}
.nook-stage .l.on{background:var(--nb)}
.nook-stagen{display:flex;justify-content:space-between;font-size:11.5px;color:var(--nm);margin-top:4px}
.nook-stagen .c{color:var(--nb2)}
.nook-chip{display:inline-block;font-size:12px;background:var(--nbs);color:var(--nb2);border-radius:999px;padding:1px 10px;margin:0 6px 6px 0}
.nook-field{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #f0f3f9;font-size:13.5px}
.nook-field:last-child{border-bottom:none}
.nook-hint{font-size:12px;color:var(--nm)}
.nook-input{border:1px solid #d5def5;border-radius:8px;padding:5px 10px;font-size:13px;min-width:120px;background:#fff;color:var(--nt)}
.nook-seg{display:inline-flex;border:1px solid #d5def5;border-radius:8px;overflow:hidden}
.nook-seg button{border:none;background:#fff;padding:4px 12px;font-size:13px;cursor:pointer;color:var(--ns)}
.nook-seg button.on{background:var(--nb);color:#fff}
.nook-onb{max-width:460px;margin:60px auto;background:#fff;border:1px solid var(--nl);border-radius:18px;padding:28px 30px}
.nook-onb h2{margin:0 0 4px;font-size:20px}
.nook-msg{font-size:12.5px;color:var(--nb2);margin-top:8px}
.nook-a{color:var(--nb2);text-decoration:none}
`;

		function useNook() {
			const [view, setView] = useState(undefined);
			const [error, setError] = useState("");
			const load = useCallback(() => fetch(`${API}/view`, { headers: { accept: "application/json" } })
				.then((r) => r.json())
				.then((d) => {
					if (!d.ok) throw new Error(d.error || "读取失败");
					setView(d.view);
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
				post("/setup", { name: name.trim() || "Nook", relation, mbti: mbti || undefined })
					.catch((e) => setMsg(String(e.message || e)))
					.finally(() => setBusy(false));
			};
			return h("div", { className: "nook-onb" },
				h("h2", null, "创建你的伙伴"),
				h("div", { className: "nook-hint", style: { marginBottom: 14 } }, "三件事，选完就能开始聊。以后都能改。"),
				h("div", { className: "nook-field" }, h("span", null, "名字"),
					h("input", { className: "nook-input", value: name, placeholder: "不填就叫 Nook", maxLength: 12, onChange: (e) => setName(e.target.value) })),
				h("div", { className: "nook-field" }, h("span", null, "关系"), h(Seg, { value: relation, options: { friend: "朋友", lover: "恋人" }, onChange: setRelation })),
				h("div", { className: "nook-field" }, h("span", null, "性格"),
					h("select", { className: "nook-input", value: mbti, onChange: (e) => setMbti(e.target.value) },
						types.map((t) => h("option", { key: t || "self", value: t }, t || "让她自己来")))),
				h("div", { className: "nook-hint", style: { marginTop: 12 } }, "头像可以在创建后上传任何你喜欢的图。聊天和联网用的是你在 dsh 里已经配好的 DeepSeek，她的记忆只存在这台电脑上。"),
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
			const threads = view.threads.filter((t) => t.owner === "user");
			const open = threads.filter((t) => t.status === "open");
			const closed = threads.filter((t) => t.status === "closed").slice(0, 5);
			const sealed = view.memories.filter((m) => m.status === "sealed");
			const gone = view.memories.filter((m) => m.status === "invalid").slice(0, 6);
			const act = (action, m) => post("/memory", { action, id: m.id });
			const byArea = {};
			for (const m of about) (byArea[m.area || "other"] ??= []).push(m);
			return h("div", { className: "nook-grid" },
				h("div", { className: "nook-card" }, h("h3", null, "进行中"),
					open.length ? open.map((t) => h("div", { key: t.id, className: "nook-row" },
						h("div", null, t.title),
						h("div", { className: "nook-meta" }, t.stage, h("span", null, `· 更新于 ${ago(t.updatedAt)}`)))) : h("div", { className: "nook-empty" }, "暂时没有。你提到有“后来呢”的事，她会记在这里。"),
					closed.length > 0 && h("div", { style: { marginTop: 10 } },
						h("div", { className: "nook-hint" }, "已经有结果的"),
						closed.map((t) => h("div", { key: t.id, className: "nook-row" },
							h("div", null, t.title), h("div", { className: "nook-meta" }, t.outcome || ""))))),
				h("div", { className: "nook-card" }, h("h3", null, "时间线"),
					view.days.length ? view.days.slice(0, 7).map((d) => h("div", { key: d.date, className: "nook-day" },
						h("div", { className: "nook-meta" }, d.date),
						h("b", null, d.title),
						h("div", null, d.summary),
						d.feeling && h("div", { className: "nook-feel" }, d.feeling))) : h("div", { className: "nook-empty" }, "每晚她会把这一天写成一张卡片。")),
				h("div", { className: "nook-card" }, h("h3", null, "关于你"),
					about.length ? Object.entries(byArea).map(([area, items]) => h("div", { key: area, style: { marginBottom: 8 } },
						h("div", { className: "nook-hint" }, AREAS[area] || "其他"),
						items.map((m) => h(MemoryRow, { key: m.id, m, act })))) : h("div", { className: "nook-empty" }, "她还在认识你。")),
				h("div", { className: "nook-card" }, h("h3", null, "约定和回忆"),
					promises.map((m) => h(MemoryRow, { key: m.id, m, act })),
					moments.map((m) => h(MemoryRow, { key: m.id, m, act })),
					!promises.length && !moments.length && h("div", { className: "nook-empty" }, "说好的事、你们的共同回忆会出现在这里。")),
				(gone.length > 0 || sealed.length > 0) && h("div", { className: "nook-card" }, h("h3", null, "不再成立 / 不再提"),
					gone.map((m) => h("div", { key: m.id, className: "nook-row" }, h("div", { className: "nook-old" }, m.text),
						h("div", { className: "nook-meta" }, m.invalidReason || ""))),
					sealed.map((m) => h("div", { key: m.id, className: "nook-row" }, h("div", null, m.text),
						h("div", { className: "nook-meta" }, "封存：你说过不想提，她不会主动提", h("button", { className: "nook-link", onClick: () => act("forget", m) }, "删掉"))))));
		}

		function MemoryRow({ m, act }) {
			const [editing, setEditing] = useState(false);
			const [text, setText] = useState(m.text);
			const was = m.history && m.history.length ? m.history[m.history.length - 1].text : "";
			return h("div", { className: "nook-row" },
				editing
					? h("div", { style: { display: "flex", gap: 8 } },
						h("input", { className: "nook-input", style: { flex: 1 }, value: text, onChange: (e) => setText(e.target.value) }),
						h("button", { className: "nook-btn", onClick: () => act("correct", { ...m, text }).then(() => setEditing(false)) }, "保存"))
					: h("div", null, m.text),
				h("div", { className: "nook-meta" },
					h("span", { className: `nook-tag ${m.source}` }, SOURCE[m.source] || m.source),
					was && h("span", null, `以前：${was}`),
					h("span", null, ago(m.createdAt)),
					h("button", { className: "nook-link", onClick: () => setEditing(!editing) }, editing ? "取消" : "改"),
					h("button", { className: "nook-link", onClick: () => act("forget", m) }, "忘掉")));
		}

		function StatusTab({ view, post }) {
			const stages = view.bond.stages;
			const stage = Math.min(view.bond.stage, stages.length - 1);
			return h("div", { className: "nook-grid" },
				h("div", { className: "nook-card" }, h("h3", null, "此刻"),
					h("div", { style: { fontSize: 18, fontWeight: 600, color: "#2f55e0" } }, view.mood.label),
					view.mood.reason && h("div", { className: "nook-hint" }, `因为${view.mood.reason}`),
					h("div", { className: "nook-hint", style: { marginTop: 6 } }, view.asleep ? `在睡觉（${view.settings.sleep.start}–${view.settings.sleep.end}），找她也会迷迷糊糊地回` : "醒着")),
				h("div", { className: "nook-card" }, h("h3", null, "你们的关系"),
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
					h("div", { className: "nook-hint", style: { marginBottom: 8 } }, `按 MBTI 的说法，她现在更像 ${view.mbti}。这个标签会随着她的变化而变。`),
					Object.entries(TRAITS).map(([k, label]) => h("div", { key: k, style: { marginBottom: 6 } },
						h("div", { className: "nook-meta", style: { justifyContent: "space-between" } }, h("span", null, label), h("span", null, view.traits[k].toFixed(2))),
						h("div", { className: "nook-bar" }, h("i", { style: { width: `${Math.round(view.traits[k] * 100)}%` } })))),
					h("div", { className: "nook-hint", style: { marginTop: 6 } }, "性格是在和你相处中慢慢形成的，每周最多变一点点。")),
				h("div", { className: "nook-card" }, h("h3", null, "成长记录"),
					view.growth.length ? view.growth.map((g) => h("div", { key: g.id, className: "nook-row" },
						g.changes.map((c, i) => h("div", { key: i }, `${TRAITS[c.trait]} ${c.to > c.from ? "多了一点" : "少了一点"}：${c.note || c.because}`)),
						h("div", { className: "nook-meta" }, new Date(g.at).toLocaleDateString(),
							g.undone ? h("span", null, "已撤销") : h("button", { className: "nook-link", onClick: () => post("/growth/undo", { id: g.id }) }, "撤销")))) : h("div", { className: "nook-empty" }, "相处一段时间后，她的变化会记在这里，你可以撤销。")),
				h("div", { className: "nook-card" }, h("h3", null, "口头禅和兴趣"),
					h("div", { className: "nook-hint" }, "口头禅"),
					view.catchphrases.length ? h("div", null, view.catchphrases.map((c) => h("span", { key: c.text, className: "nook-chip" }, `${c.text}${c.origin === "user" ? "（跟你学的）" : ""}`))) : h("div", { className: "nook-empty" }, "还没有。聊多了会慢慢长出来。"),
					h("div", { className: "nook-hint", style: { marginTop: 8 } }, "最近感兴趣的"),
					h("div", null, view.interests.map((i) => h("span", { key: i.topic, className: "nook-chip" }, i.topic)))),
				h("div", { className: "nook-card" }, h("h3", null, "她对你的了解"),
					Object.entries(AREAS).map(([k, label]) => h("div", { key: k, className: "nook-field" }, h("span", null, label),
						h("span", { className: "nook-hint" }, KNOW_LEVELS[view.know[k] || 0])))));
		}

		function ReadingTab({ view }) {
			const label = { ok: "读了", failed: "没搜到", withdrawn: "已撤回" };
			return h("div", { className: "nook-card" }, h("h3", null, "她自己读的"),
				view.notes.length ? view.notes.map((n) => h("div", { key: n.id, className: "nook-row" },
					n.kind === "chat"
						? h("div", null, `聊天时查了「${n.query}」`)
						: n.status === "failed"
							? h("div", null, `想查「${n.query}」，没搜到靠谱的`)
							: h("div", null, h("a", { className: "nook-a", href: n.url, target: "_blank", rel: "noreferrer" }, n.title)),
					n.takeaway && h("div", { className: "nook-hint" }, n.takeaway),
					h("div", { className: "nook-meta" }, h("span", { className: "nook-tag" }, label[n.status] || n.status), ago(n.at), n.shared && h("span", null, "· 分享给你了")))) : h("div", { className: "nook-empty" }, "她自己出去逛的时候，读到的东西会出现在这里。"));
		}

		function SettingsTab({ view, post, reload }) {
			const s = view.settings;
			const [name, setName] = useState(view.companion.name);
			const set = (patch) => post("/settings", patch);
			return h("div", { className: "nook-grid" },
				h("div", { className: "nook-card" }, h("h3", null, "基本信息"),
					h("div", { className: "nook-field" }, h("span", { style: { display: "flex", alignItems: "center", gap: 10 } }, h(Avatar, { view, size: 40 }), "头像"),
						h(AvatarUpload, { onDone: reload, label: "换一张" })),
					h("div", { className: "nook-field" }, h("span", null, "名字"),
						h("span", { style: { display: "flex", gap: 6 } },
							h("input", { className: "nook-input", value: name, maxLength: 12, onChange: (e) => setName(e.target.value) }),
							h("button", { className: "nook-btn", onClick: () => set({ name }) }, "保存"))),
					h("div", { className: "nook-field" }, h("span", null, "关系"), h(Seg, { value: view.companion.relation, options: { friend: "朋友", lover: "恋人" }, onChange: (v) => set({ relation: v }) }))),
				h("div", { className: "nook-card" }, h("h3", null, "主动消息"),
					h("div", { className: "nook-field" }, h("span", null, "主动消息频率"), h(Seg, { value: s.outreach, options: OUTREACH, onChange: (v) => set({ outreach: v }) })),
					h("div", { className: "nook-field" }, h("span", null, "作息时间", h("div", { className: "nook-hint" }, "睡着时找她也会回；这段时间她不主动找你")),
						h("span", { style: { display: "flex", gap: 6, alignItems: "center" } },
							h("input", { className: "nook-input", style: { minWidth: 70, width: 70 }, defaultValue: s.sleep.start, onBlur: (e) => set({ sleep: { start: e.target.value, end: s.sleep.end } }) }),
							"–",
							h("input", { className: "nook-input", style: { minWidth: 70, width: 70 }, defaultValue: s.sleep.end, onBlur: (e) => set({ sleep: { start: s.sleep.start, end: e.target.value } }) }))),
					h("div", { className: "nook-field" }, h("span", null, "工作时不打扰", h("div", { className: "nook-hint" }, "你在其他会话里干活时，她先等等")),
						h(Seg, { value: s.respectWork ? "on" : "off", options: { on: "开", off: "关" }, onChange: (v) => set({ respectWork: v === "on" }) }))),
				h("div", { className: "nook-card" }, h("h3", null, "她自己的时间"),
					h("div", { className: "nook-field" }, h("span", null, "自己去网上看东西", h("div", { className: "nook-hint" }, "用 dsh 里配好的 DeepSeek 联网")),
						h(Seg, { value: s.explore ? "on" : "off", options: { on: "开", off: "关" }, onChange: (v) => set({ explore: v === "on" }) })),
					h("div", { className: "nook-field" }, h("span", null, "暂停 Nook", h("div", { className: "nook-hint" }, "暂停后她不会自己去逛，也不会主动找你")),
						h(Seg, { value: s.enabled ? "on" : "off", options: { on: "运行中", off: "暂停" }, onChange: (v) => set({ enabled: v === "on" }) }))));
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
						h(Avatar, { view }),
						h("div", { style: { flex: 1 } },
							h("div", { className: "nook-name" }, view.companion.name),
							h("div", { className: "nook-sub" }, headline(view))),
						h("button", { className: "nook-btn pri", disabled: opening, onClick: () => { setOpening(true); openChat(view.sessions); setTimeout(() => setOpening(false), 1500); } }, `和${view.companion.name}聊天`)),
					h("div", { className: "nook-tabs" }, Object.entries(tabs).map(([k, label]) =>
						h("button", { key: k, className: `nook-tab ${tab === k ? "on" : ""}`, onClick: () => setTab(k) }, label))),
					h(Tab, { view, post, reload }));
			}
			return h("div", { className: "nook" }, h("style", null, CSS), body);
		}

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
				label: () => "Nook",
			}, NookIcon));
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

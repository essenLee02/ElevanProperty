import { reactive as $, nextTick as ie, toRaw as h, isVNode as ce, createApp as _e, mergeProps as b, defineComponent as Z, ref as M, computed as g, watchEffect as z, createVNode as u, cloneVNode as Ne, onMounted as fe, onUnmounted as me, h as D, Fragment as Ae } from "vue";
const H = {
  TOP_LEFT: "top-left",
  TOP_RIGHT: "top-right",
  TOP_CENTER: "top-center",
  BOTTOM_LEFT: "bottom-left",
  BOTTOM_RIGHT: "bottom-right",
  BOTTOM_CENTER: "bottom-center"
}, q = {
  LIGHT: "light",
  DARK: "dark",
  COLORED: "colored",
  AUTO: "auto"
}, E = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
  DEFAULT: "default"
}, Ie = {
  BOUNCE: "bounce",
  SLIDE: "slide",
  FLIP: "flip",
  ZOOM: "zoom",
  NONE: "none"
}, Oe = {
  dangerouslyHTMLString: !1,
  multiple: !0,
  position: H.TOP_RIGHT,
  autoClose: 5e3,
  transition: "bounce",
  hideProgressBar: !1,
  pauseOnHover: !0,
  pauseOnFocusLoss: !0,
  closeOnClick: !0,
  className: "",
  bodyClassName: "",
  style: {},
  progressClassName: "",
  progressStyle: {},
  role: "alert",
  theme: "light"
}, Pe = {
  rtl: !1,
  newestOnTop: !1,
  toastClassName: ""
}, ge = {
  ...Oe,
  ...Pe
};
E.DEFAULT;
var r = /* @__PURE__ */ ((e) => (e[e.COLLAPSE_DURATION = 300] = "COLLAPSE_DURATION", e[e.DEBOUNCE_DURATION = 50] = "DEBOUNCE_DURATION", e.CSS_NAMESPACE = "Toastify", e))(r || {}), ne = /* @__PURE__ */ ((e) => (e.ENTRANCE_ANIMATION_END = "d", e))(ne || {});
const be = {
  enter: "Toastify--animate Toastify__bounce-enter",
  exit: "Toastify--animate Toastify__bounce-exit",
  appendPosition: !0
}, Le = {
  enter: "Toastify--animate Toastify__slide-enter",
  exit: "Toastify--animate Toastify__slide-exit",
  appendPosition: !0
}, $e = {
  enter: "Toastify--animate Toastify__zoom-enter",
  exit: "Toastify--animate Toastify__zoom-exit"
}, we = {
  enter: "Toastify--animate Toastify__flip-enter",
  exit: "Toastify--animate Toastify__flip-exit"
}, de = "Toastify--animate Toastify__none-enter";
function Ee(e, t = !1) {
  var a;
  let n = be;
  if (!e || typeof e == "string")
    switch (e) {
      case "flip":
        n = we;
        break;
      case "zoom":
        n = $e;
        break;
      case "slide":
        n = Le;
        break;
    }
  else
    n = e;
  if (t)
    n.enter = de;
  else if (n.enter === de) {
    const o = (a = n.exit.split("__")[1]) == null ? void 0 : a.split("-")[0];
    n.enter = `Toastify--animate Toastify__${o}-enter`;
  }
  return n;
}
function Me(e) {
  return e.containerId || String(e.position);
}
const X = "will-unmount";
function Be(e = H.TOP_RIGHT) {
  return !!document.querySelector(`.${r.CSS_NAMESPACE}__toast-container--${e}`);
}
function qe(e = H.TOP_RIGHT) {
  return `${r.CSS_NAMESPACE}__toast-container--${e}`;
}
function Re(e, t, n = !1) {
  const a = [
    `${r.CSS_NAMESPACE}__toast-container`,
    `${r.CSS_NAMESPACE}__toast-container--${e}`,
    n ? `${r.CSS_NAMESPACE}__toast-container--rtl` : null
  ].filter(Boolean).join(" ");
  return B(t) ? t({
    position: e,
    rtl: n,
    defaultClassName: a
  }) : `${a} ${t || ""}`;
}
function Fe(e) {
  var m;
  const { position: t, containerClassName: n, rtl: a = !1, style: o = {} } = e, s = r.CSS_NAMESPACE, d = qe(t), C = document.querySelector(`.${s}`), c = document.querySelector(`.${d}`), _ = !!c && !((m = c.className) != null && m.includes(X)), v = C || document.createElement("div"), i = document.createElement("div");
  i.className = Re(
    t,
    n,
    a
  ), i.dataset.testid = `${r.CSS_NAMESPACE}__toast-container--${t}`, i.id = Me(e);
  for (const T in o)
    if (Object.prototype.hasOwnProperty.call(o, T)) {
      const N = o[T];
      i.style[T] = N;
    }
  return C || (v.className = r.CSS_NAMESPACE, document.body.appendChild(v)), _ || v.appendChild(i), i;
}
function ae(e) {
  var a, o, s;
  const t = typeof e == "string" ? e : ((a = e.currentTarget) == null ? void 0 : a.id) || ((o = e.target) == null ? void 0 : o.id), n = document.getElementById(t);
  n && n.removeEventListener("animationend", ae, !1);
  try {
    k[t].unmount(), (s = document.getElementById(t)) == null || s.remove(), delete k[t], delete f[t];
  } catch {
  }
}
const k = $({});
function xe(e, t) {
  const n = document.getElementById(String(t));
  n && (k[n.id] = e);
}
function oe(e, t = !0) {
  const n = String(e);
  if (!k[n]) return;
  const a = document.getElementById(n);
  a && a.classList.add(X), t ? (ke(e), a && a.addEventListener("animationend", ae, !1)) : ae(n), p.items = p.items.filter((o) => o.containerId !== e);
}
function Ue(e) {
  for (const t in k)
    oe(t, e);
  p.items = [];
}
function Ce(e, t) {
  const n = document.getElementById(e.toastId);
  if (n) {
    let a = e;
    a = {
      ...a,
      ...Ee(a.transition)
    };
    const o = a.appendPosition ? `${a.exit}--${a.position}` : a.exit;
    n.className += ` ${o}`, t && t(n);
  }
}
function ke(e) {
  for (const t in f)
    if (t === e)
      for (const n of f[t] || [])
        Ce(n);
}
function He(e) {
  const n = R().find((a) => a.toastId === e);
  return n == null ? void 0 : n.containerId;
}
function le(e) {
  return document.getElementById(e);
}
function De(e) {
  const t = le(e.containerId);
  return t && t.classList.contains(X);
}
function ue(e) {
  var n;
  const t = ce(e.content) ? h(e.content.props) : null;
  return t != null ? t : h((n = e.data) != null ? n : {});
}
function je(e) {
  return e ? p.items.filter((n) => n.containerId === e).length > 0 : p.items.length > 0;
}
function ze() {
  if (p.items.length > 0) {
    const e = p.items.shift();
    G(e == null ? void 0 : e.toastContent, e == null ? void 0 : e.toastProps);
  }
}
const f = $({}), p = $({ items: [] });
function R() {
  const e = h(f);
  return Object.values(e).reduce((t, n) => [...t, ...n], []);
}
function Ge(e) {
  return R().find((n) => n.toastId === e);
}
function G(e, t = {}) {
  if (De(t)) {
    const n = le(t.containerId);
    n && n.addEventListener("animationend", se.bind(null, e, t), !1);
  } else
    se(e, t);
}
function se(e, t = {}) {
  const n = le(t.containerId);
  n && n.removeEventListener("animationend", se.bind(null, e, t), !1);
  const a = f[t.containerId] || [], o = a.length > 0;
  if (!o && !Be(t.position)) {
    const s = Fe(t), d = _e(Et, t);
    t.useHandler && t.useHandler(d), d.mount(s), xe(d, s.id);
  }
  o && !t.updateId && (t.position = a[0].position), ie(() => {
    t.updateId ? y.update(t) : y.add(e, t);
  });
}
const y = {
  /**
   * add a toast
   * @param _ ..
   * @param opts toast props
   */
  add(e, t) {
    const { containerId: n = "" } = t;
    n && (f[n] = f[n] || [], f[n].find((a) => a.toastId === t.toastId) || setTimeout(() => {
      var a, o;
      t.newestOnTop ? (a = f[n]) == null || a.unshift(t) : (o = f[n]) == null || o.push(t), t.onOpen && t.onOpen(ue(t));
    }, t.delay || 0));
  },
  /**
   * remove a toast
   * @param id toastId
   */
  remove(e) {
    if (e) {
      const t = He(e);
      if (t) {
        const n = f[t];
        let a = n.find((o) => o.toastId === e);
        f[t] = n.filter((o) => o.toastId !== e), !f[t].length && !je(t) && oe(t, !1), ze(), ie(() => {
          a != null && a.onClose && (a.onClose(ue(a)), a = void 0);
        });
      }
    }
  },
  /**
   * update the toast
   * @param opts toast props
   */
  update(e = {}) {
    const { containerId: t = "" } = e;
    if (t && e.updateId) {
      f[t] = f[t] || [];
      const n = f[t].find((s) => s.toastId === e.toastId), a = (n == null ? void 0 : n.position) !== e.position || (n == null ? void 0 : n.transition) !== e.transition, o = {
        ...e,
        disabledEnterTransition: !a,
        updateId: void 0
      };
      y.dismissForce(e == null ? void 0 : e.toastId), setTimeout(() => {
        l(o.content, o);
      }, e.delay || 0);
    }
  },
  /**
   * clear all toasts in container.
   * @param containerId container id
   */
  clear(e, t = !0) {
    e ? oe(e, t) : Ue(t);
  },
  dismissCallback(e) {
    var a;
    const t = (a = e.currentTarget) == null ? void 0 : a.id, n = document.getElementById(t);
    n && (n.removeEventListener("animationend", y.dismissCallback, !1), setTimeout(() => {
      y.remove(t);
    }));
  },
  dismiss(e) {
    if (e) {
      const t = R();
      for (const n of t)
        if (n.toastId === e) {
          Ce(n, (a) => {
            a.addEventListener("animationend", y.dismissCallback, !1);
          });
          break;
        }
    }
  },
  dismissForce(e) {
    if (e) {
      const t = R();
      for (const n of t)
        if (n.toastId === e) {
          const a = document.getElementById(e);
          a && (a.remove(), a.removeEventListener("animationend", y.dismissCallback, !1), y.remove(e));
          break;
        }
    }
  }
}, Ve = $({ useHandler: void 0 }), ye = $({}), K = $({});
function ve() {
  return Math.random().toString(36).substring(2, 9);
}
function We(e) {
  return typeof e == "number" && !isNaN(e);
}
function re(e) {
  return typeof e == "string";
}
function B(e) {
  return typeof e == "function";
}
function J(...e) {
  return b(...e);
}
function V(e) {
  return typeof e == "object" && (!!(e != null && e.render) || !!(e != null && e.setup) || typeof (e == null ? void 0 : e.type) == "object");
}
function Qe(e = {}) {
  ye[`${r.CSS_NAMESPACE}-default-options`] = e;
}
function Se() {
  return ye[`${r.CSS_NAMESPACE}-default-options`] || ge;
}
function Ke() {
  const e = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return document.documentElement.classList.contains("dark") || e ? "dark" : "light";
}
var W = /* @__PURE__ */ ((e) => (e[e.Enter = 0] = "Enter", e[e.Exit = 1] = "Exit", e))(W || {});
const pe = {
  containerId: {
    type: [String, Number],
    required: !1,
    default: ""
  },
  clearOnUrlChange: {
    type: Boolean,
    required: !1,
    default: !0
  },
  disabledEnterTransition: {
    type: Boolean,
    required: !1,
    default: !1
  },
  dangerouslyHTMLString: {
    type: Boolean,
    required: !1,
    default: !1
  },
  multiple: {
    type: Boolean,
    required: !1,
    default: !0
  },
  limit: {
    type: Number,
    required: !1,
    default: void 0
  },
  position: {
    type: String,
    required: !1,
    default: H.TOP_LEFT
  },
  bodyClassName: {
    type: String,
    required: !1,
    default: ""
  },
  autoClose: {
    type: [Number, Boolean],
    required: !1,
    default: !1
  },
  closeButton: {
    type: [Boolean, Function, Object],
    required: !1,
    default: void 0
  },
  transition: {
    type: [String, Object],
    required: !1,
    default: "bounce"
  },
  hideProgressBar: {
    type: Boolean,
    required: !1,
    default: !1
  },
  pauseOnHover: {
    type: Boolean,
    required: !1,
    default: !0
  },
  pauseOnFocusLoss: {
    type: Boolean,
    required: !1,
    default: !0
  },
  closeOnClick: {
    type: Boolean,
    required: !1,
    default: !0
  },
  progress: {
    type: Number,
    required: !1,
    default: void 0
  },
  progressClassName: {
    type: String,
    required: !1,
    default: ""
  },
  toastStyle: {
    type: Object,
    required: !1,
    default() {
      return {};
    }
  },
  progressStyle: {
    type: Object,
    required: !1,
    default() {
      return {};
    }
  },
  role: {
    type: String,
    required: !1,
    default: "alert"
  },
  theme: {
    type: String,
    required: !1,
    default: q.AUTO
  },
  content: {
    type: [String, Object, Function],
    required: !1,
    default: ""
  },
  toastId: {
    type: [String, Number],
    required: !1,
    default: ""
  },
  data: {
    type: [Object, String],
    required: !1,
    default() {
      return {};
    }
  },
  type: {
    type: String,
    required: !1,
    default: E.DEFAULT
  },
  icon: {
    type: [Boolean, String, Number, Object, Function],
    required: !1,
    default: void 0
  },
  delay: {
    type: Number,
    required: !1,
    default: void 0
  },
  onOpen: {
    type: Function,
    required: !1,
    default: void 0
  },
  onClose: {
    type: Function,
    required: !1,
    default: void 0
  },
  onClick: {
    type: Function,
    required: !1,
    default: void 0
  },
  isLoading: {
    type: Boolean,
    required: !1,
    default: void 0
  },
  rtl: {
    type: Boolean,
    required: !1,
    default: !1
  },
  toastClassName: {
    type: String,
    required: !1,
    default: ""
  },
  updateId: {
    type: [String, Number],
    required: !1,
    default: ""
  },
  contentProps: {
    type: Object,
    required: !1,
    default: null
  },
  expandCustomProps: {
    type: Boolean,
    required: !1,
    default: !1
  }
}, Ye = {
  autoClose: {
    type: [Number, Boolean],
    required: !0
  },
  isRunning: {
    type: Boolean,
    required: !1,
    default: void 0
  },
  type: {
    type: String,
    required: !1,
    default: E.DEFAULT
  },
  theme: {
    type: String,
    required: !1,
    default: q.AUTO
  },
  hide: {
    type: Boolean,
    required: !1,
    default: void 0
  },
  className: {
    type: [String, Function],
    required: !1,
    default: ""
  },
  controlledProgress: {
    type: Boolean,
    required: !1,
    default: void 0
  },
  rtl: {
    type: Boolean,
    required: !1,
    default: void 0
  },
  isIn: {
    type: Boolean,
    required: !1,
    default: void 0
  },
  progress: {
    type: Number,
    required: !1,
    default: void 0
  },
  closeToast: {
    type: Function,
    required: !1,
    default: void 0
  }
}, Ze = /* @__PURE__ */ Z({
  name: "ProgressBar",
  props: Ye,
  // @ts-ignore
  setup(e, {
    attrs: t
  }) {
    const n = M(), a = g(() => e.hide ? "true" : "false"), o = g(() => ({
      ...t.style || {},
      animationDuration: `${e.autoClose === !0 ? 5e3 : e.autoClose}ms`,
      animationPlayState: e.isRunning ? "running" : "paused",
      opacity: e.hide || e.autoClose === !1 ? 0 : 1,
      transform: e.controlledProgress ? `scaleX(${e.progress})` : "none"
    })), s = g(() => [`${r.CSS_NAMESPACE}__progress-bar`, e.controlledProgress ? `${r.CSS_NAMESPACE}__progress-bar--controlled` : `${r.CSS_NAMESPACE}__progress-bar--animated`, `${r.CSS_NAMESPACE}__progress-bar-theme--${e.theme}`, `${r.CSS_NAMESPACE}__progress-bar--${e.type}`, e.rtl ? `${r.CSS_NAMESPACE}__progress-bar--rtl` : null].filter(Boolean).join(" ")), d = g(() => `${s.value} ${(t == null ? void 0 : t.class) || ""}`), C = () => {
      n.value && (n.value.onanimationend = null, n.value.ontransitionend = null);
    }, c = () => {
      e.isIn && e.closeToast && e.autoClose !== !1 && (e.closeToast(), C());
    }, _ = g(() => e.controlledProgress ? null : c), v = g(() => e.controlledProgress ? c : null);
    return z(() => {
      n.value && (C(), n.value.onanimationend = _.value, n.value.ontransitionend = v.value);
    }), () => u("div", {
      ref: n,
      role: "progressbar",
      "aria-hidden": a.value,
      "aria-label": "notification timer",
      class: d.value,
      style: o.value
    }, null);
  }
}), Xe = /* @__PURE__ */ Z({
  name: "CloseButton",
  inheritAttrs: !1,
  props: {
    theme: {
      type: String,
      required: !1,
      default: q.AUTO
    },
    type: {
      type: String,
      required: !1,
      default: q.LIGHT
    },
    ariaLabel: {
      type: String,
      required: !1,
      default: "close"
    },
    closeToast: {
      type: Function,
      required: !1,
      default: void 0
    }
  },
  setup(e) {
    return () => u("button", {
      class: `${r.CSS_NAMESPACE}__close-button ${r.CSS_NAMESPACE}__close-button--${e.theme}`,
      type: "button",
      onClick: (t) => {
        t.stopPropagation(), e.closeToast && e.closeToast(t);
      },
      "aria-label": e.ariaLabel
    }, [u("svg", {
      "aria-hidden": "true",
      viewBox: "0 0 14 16"
    }, [u("path", {
      "fill-rule": "evenodd",
      d: "M7.71 8.23l3.75 3.75-1.48 1.48-3.75-3.75-3.75 3.75L1 11.98l3.75-3.75L1 4.48 2.48 3l3.75 3.75L9.98 3l1.48 1.48-3.75 3.75z"
    }, null)])]);
  }
}), ee = ({
  theme: e,
  type: t,
  path: n,
  ...a
}) => u("svg", b({
  viewBox: "0 0 24 24",
  width: "100%",
  height: "100%",
  style: {
    fill: e === "colored" ? "currentColor" : `var(--toastify-icon-color-${t})`
  }
}, a), [u("path", {
  d: n
}, null)]);
function Je(e) {
  return u(ee, b(e, {
    path: "M23.32 17.191L15.438 2.184C14.728.833 13.416 0 11.996 0c-1.42 0-2.733.833-3.443 2.184L.533 17.448a4.744 4.744 0 000 4.368C1.243 23.167 2.555 24 3.975 24h16.05C22.22 24 24 22.044 24 19.632c0-.904-.251-1.746-.68-2.44zm-9.622 1.46c0 1.033-.724 1.823-1.698 1.823s-1.698-.79-1.698-1.822v-.043c0-1.028.724-1.822 1.698-1.822s1.698.79 1.698 1.822v.043zm.039-12.285l-.84 8.06c-.057.581-.408.943-.897.943-.49 0-.84-.367-.896-.942l-.84-8.065c-.057-.624.25-1.095.779-1.095h1.91c.528.005.84.476.784 1.1z"
  }), null);
}
function et(e) {
  return u(ee, b(e, {
    path: "M12 0a12 12 0 1012 12A12.013 12.013 0 0012 0zm.25 5a1.5 1.5 0 11-1.5 1.5 1.5 1.5 0 011.5-1.5zm2.25 13.5h-4a1 1 0 010-2h.75a.25.25 0 00.25-.25v-4.5a.25.25 0 00-.25-.25h-.75a1 1 0 010-2h1a2 2 0 012 2v4.75a.25.25 0 00.25.25h.75a1 1 0 110 2z"
  }), null);
}
function tt(e) {
  return u(ee, b(e, {
    path: "M12 0a12 12 0 1012 12A12.014 12.014 0 0012 0zm6.927 8.2l-6.845 9.289a1.011 1.011 0 01-1.43.188l-4.888-3.908a1 1 0 111.25-1.562l4.076 3.261 6.227-8.451a1 1 0 111.61 1.183z"
  }), null);
}
function nt(e) {
  return u(ee, b(e, {
    path: "M11.983 0a12.206 12.206 0 00-8.51 3.653A11.8 11.8 0 000 12.207 11.779 11.779 0 0011.8 24h.214A12.111 12.111 0 0024 11.791 11.766 11.766 0 0011.983 0zM10.5 16.542a1.476 1.476 0 011.449-1.53h.027a1.527 1.527 0 011.523 1.47 1.475 1.475 0 01-1.449 1.53h-.027a1.529 1.529 0 01-1.523-1.47zM11 12.5v-6a1 1 0 012 0v6a1 1 0 11-2 0z"
  }), null);
}
function at() {
  return u("div", {
    class: `${r.CSS_NAMESPACE}__spinner`
  }, null);
}
const Q = {
  info: et,
  warning: Je,
  success: tt,
  error: nt,
  spinner: at
}, ot = (e) => e in Q;
function st({
  theme: e,
  type: t,
  isLoading: n,
  icon: a
}) {
  let o;
  const s = !!n || t === "loading", d = {
    theme: e,
    type: t
  };
  if (s && (a === void 0 || typeof a == "boolean")) return Q.spinner();
  if (a !== !1) {
    if (V(a))
      o = h(a);
    else if (B(a)) {
      const C = a;
      d.type = s ? "loading" : t, o = C(d), o = !o && s ? Q.spinner() : o;
    } else ce(a) ? o = Ne(a, d) : re(a) || We(a) ? o = a : ot(t) && (o = Q[t](d));
    return o;
  }
}
const rt = () => {
};
function it(e, t, n = r.COLLAPSE_DURATION) {
  const { scrollHeight: a, style: o } = e, s = n;
  requestAnimationFrame(() => {
    o.minHeight = "initial", o.height = a + "px", o.transition = `all ${s}ms`, requestAnimationFrame(() => {
      o.height = "0", o.padding = "0", o.margin = "0", setTimeout(t, s);
    });
  });
}
function lt(e) {
  const t = M(!1), n = M(!1), a = M(!1), o = M(W.Enter), s = $({
    ...e,
    appendPosition: e.appendPosition || !1,
    collapse: typeof e.collapse > "u" ? !0 : e.collapse,
    collapseDuration: e.collapseDuration || r.COLLAPSE_DURATION
  }), d = s.done || rt, C = g(() => s.appendPosition ? `${s.enter}--${s.position}` : s.enter), c = g(() => s.appendPosition ? `${s.exit}--${s.position}` : s.exit), _ = g(() => e.pauseOnHover ? {
    onMouseenter: I,
    onMouseleave: A
  } : {});
  function v() {
    const S = C.value.split(" ");
    m().addEventListener(
      ne.ENTRANCE_ANIMATION_END,
      A,
      { once: !0 }
    );
    const O = (w) => {
      const x = m();
      w.target === x && (x.dispatchEvent(new Event(ne.ENTRANCE_ANIMATION_END)), x.removeEventListener("animationend", O), x.removeEventListener("animationcancel", O), o.value === W.Enter && w.type !== "animationcancel" && x.classList.remove(...S));
    }, P = () => {
      const w = m();
      w.classList.add(...S), w.addEventListener("animationend", O), w.addEventListener("animationcancel", O);
    };
    e.pauseOnFocusLoss && T(), P();
  }
  function i() {
    if (!m()) return;
    const S = () => {
      const P = m();
      P.removeEventListener("animationend", S), s.collapse ? it(P, d, s.collapseDuration) : d();
    }, O = () => {
      const P = m();
      o.value = W.Exit, P && (P.className += ` ${c.value}`, P.addEventListener("animationend", S));
    };
    n.value || (a.value ? S() : setTimeout(O));
  }
  function m() {
    return e.toastRef.value;
  }
  function T() {
    document.hasFocus() || I(), window.addEventListener("focus", A), window.addEventListener("blur", I);
  }
  function N() {
    window.removeEventListener("focus", A), window.removeEventListener("blur", I);
  }
  function A() {
    (!e.loading.value || e.isLoading === void 0) && (t.value = !0);
  }
  function I() {
    t.value = !1;
  }
  function F(S) {
    S && (S.stopPropagation(), S.preventDefault()), n.value = !1;
  }
  return z(i), z(() => {
    const S = R();
    n.value = S.findIndex((O) => O.toastId === s.toastId) > -1;
  }), z(() => {
    e.isLoading !== void 0 && (e.loading.value ? I() : A());
  }), fe(v), me(() => {
    e.pauseOnFocusLoss && N();
  }), {
    isIn: n,
    isRunning: t,
    hideToast: F,
    eventHandlers: _
  };
}
function dt(e) {
  if (!e || typeof e != "object" || Array.isArray(e) || e.__v_isVNode)
    return !1;
  const t = e;
  return ["title", "content"].some((n) => n in t);
}
const ut = /* @__PURE__ */ Z({
  name: "ToastItem",
  inheritAttrs: !1,
  props: pe,
  // @ts-ignore
  setup(e) {
    const t = M(), n = g(() => !!e.isLoading), a = g(() => e.progress !== void 0 && e.progress !== null), o = g(() => st(e)), s = g(() => [`${r.CSS_NAMESPACE}__toast`, `${r.CSS_NAMESPACE}__toast-theme--${e.theme}`, `${r.CSS_NAMESPACE}__toast--${e.type}`, e.rtl ? `${r.CSS_NAMESPACE}__toast--rtl` : void 0, e.toastClassName || ""].filter(Boolean).join(" ")), {
      isRunning: d,
      isIn: C,
      hideToast: c,
      eventHandlers: _
    } = lt({
      toastRef: t,
      loading: n,
      done: () => {
        y.remove(e.toastId);
      },
      ...Ee(e.transition, e.disabledEnterTransition),
      ...e
    });
    function v() {
      const i = e.content;
      if (dt(i)) {
        const m = [];
        return i.title !== void 0 && m.push(u("div", {
          "data-testid": "toast-text-title",
          class: `${r.CSS_NAMESPACE}__toast-text-title`
        }, [i.title])), i.content !== void 0 && m.push(u("div", {
          "data-testid": "toast-text-content",
          class: `${r.CSS_NAMESPACE}__toast-text-content`
        }, [i.content])), u("div", {
          "data-testid": "toast-text-content-wrapper",
          class: `${r.CSS_NAMESPACE}__toast-text`
        }, [m]);
      }
      return V(i) ? D(h(i), {
        toastProps: h(e),
        closeToast: c,
        data: e.data,
        ...e.expandCustomProps ? e.contentProps : {
          contentProps: e.contentProps || {}
        }
      }) : B(i) ? i({
        toastProps: h(e),
        closeToast: c,
        data: e.data
      }) : e.dangerouslyHTMLString ? D("div", {
        innerHTML: i
      }) : i;
    }
    return () => u("div", b({
      id: e.toastId,
      class: s.value,
      style: e.toastStyle || {},
      ref: t,
      "data-testid": `toast-item-${e.toastId}`,
      onClick: (i) => {
        e.closeOnClick && c(), e.onClick && e.onClick(i);
      }
    }, _.value), [u("div", {
      role: e.role,
      "data-testid": "toast-body",
      class: `${r.CSS_NAMESPACE}__toast-body ${e.bodyClassName || ""}`
    }, [o.value != null && u("div", {
      "data-testid": `toast-icon-${e.type}`,
      class: [`${r.CSS_NAMESPACE}__toast-icon`, e.isLoading ? "" : `${r.CSS_NAMESPACE}--animate-icon ${r.CSS_NAMESPACE}__zoom-enter`].join(" ")
    }, [V(o.value) ? D(h(o.value), {
      theme: e.theme,
      type: e.type
    }) : B(o.value) ? o.value({
      theme: e.theme,
      type: e.type
    }) : o.value]), u("div", {
      "data-testid": "toast-content"
    }, [v()])]), (e.closeButton === void 0 || e.closeButton === !0) && u(Xe, {
      theme: e.theme,
      closeToast: (i) => {
        i.stopPropagation(), i.preventDefault(), c();
      }
    }, null), V(e.closeButton) ? D(h(e.closeButton), {
      closeToast: c,
      type: e.type,
      theme: e.theme
    }) : B(e.closeButton) ? e.closeButton({
      closeToast: c,
      type: e.type,
      theme: e.theme
    }) : null, u(Ze, {
      className: e.progressClassName,
      style: e.progressStyle,
      rtl: e.rtl,
      theme: e.theme,
      isIn: C.value,
      type: e.type,
      hide: e.hideProgressBar,
      isRunning: d.value,
      autoClose: e.autoClose,
      controlledProgress: a.value,
      progress: e.progress,
      closeToast: e.isLoading ? void 0 : c
    }, null)]);
  }
}), Y = "vue3-toastify:url-change";
let j = 0, U;
function ct() {
  if (!(typeof window > "u") && K.lastUrl !== window.location.href) {
    K.lastUrl = window.location.href;
    const e = (n) => typeof n.clearOnUrlChange == "boolean" ? n.clearOnUrlChange : Se().clearOnUrlChange !== !1, t = Object.values(f).reduce((n, a) => (Array.isArray(a) && n.push(...a), n), []);
    for (const n of t)
      n.toastId && e(n) && y.dismiss(n.toastId);
    p.items = p.items.filter((n) => !e(n.toastProps));
  }
}
function ft() {
  const {
    history: e
  } = window, t = e.pushState, n = e.replaceState;
  return e.pushState = function(...a) {
    const o = t.apply(this, a);
    return window.dispatchEvent(new Event(Y)), o;
  }, e.replaceState = function(...a) {
    const o = n.apply(this, a);
    return window.dispatchEvent(new Event(Y)), o;
  }, () => {
    e.pushState = t, e.replaceState = n;
  };
}
function mt() {
  if (typeof window > "u" || U)
    return;
  const e = ft(), t = () => ct();
  window.addEventListener(Y, t), window.addEventListener("popstate", t), window.addEventListener("hashchange", t), U = () => {
    e(), window.removeEventListener(Y, t), window.removeEventListener("popstate", t), window.removeEventListener("hashchange", t), U = void 0;
  };
}
function gt() {
  U && (U(), K.lastUrl = "");
}
const Et = /* @__PURE__ */ Z({
  name: "ToastifyContainer",
  inheritAttrs: !1,
  props: pe,
  // @ts-ignore
  setup(e) {
    const t = g(() => e.containerId), n = g(() => f[t.value] || []), a = g(() => n.value.filter((o) => o.position === e.position));
    return fe(() => {
      typeof window < "u" && (j += 1, mt());
    }), me(() => {
      typeof window < "u" && j > 0 && (j -= 1, j === 0 && gt());
    }), () => u(Ae, null, [a.value.map((o) => {
      const {
        toastId: s = ""
      } = o;
      return u(ut, b({
        key: s
      }, o), null);
    })]);
  }
});
let te = !1;
const Te = {
  isLoading: !0,
  autoClose: !1,
  closeOnClick: !1,
  closeButton: !1,
  draggable: !1
};
function he() {
  const e = [];
  return R().forEach((n) => {
    const a = document.getElementById(n.containerId);
    a && !a.classList.contains(X) && e.push(n);
  }), e;
}
function Ct(e) {
  const t = he().length, n = e != null ? e : 0;
  return n > 0 && t + p.items.length >= n;
}
function yt(e) {
  Ct(e.limit) && !e.updateId && p.items.push({
    toastId: e.toastId,
    containerId: e.containerId,
    toastContent: e.content,
    toastProps: e
  });
}
function L(e, t, n = {}) {
  if (te) return;
  n = J(Se(), {
    type: t
  }, h(n)), (!n.toastId || typeof n.toastId != "string" && typeof n.toastId != "number") && (n.toastId = ve()), n = {
    ...n,
    ...n.type === "loading" ? Te : {},
    content: e,
    containerId: n.containerId || String(n.position)
  };
  const a = Number(n == null ? void 0 : n.progress);
  return !isNaN(a) && a < 0 && (n.progress = 0), a > 1 && (n.progress = 1), n.theme === "auto" && (n.theme = Ke()), yt(n), K.lastUrl = window.location.href, n.multiple ? p.items.length ? n.updateId && G(e, n) : G(e, n) : (te = !0, l.clearAll(void 0, !1), setTimeout(() => {
    G(e, n);
  }, 0), setTimeout(() => {
    te = !1;
  }, 390)), n.toastId;
}
const l = (e, t) => L(e, E.DEFAULT, t);
l.info = (e, t) => L(e, E.DEFAULT, {
  ...t,
  type: E.INFO
});
l.error = (e, t) => L(e, E.DEFAULT, {
  ...t,
  type: E.ERROR
});
l.warning = (e, t) => L(e, E.DEFAULT, {
  ...t,
  type: E.WARNING
});
l.warn = l.warning;
l.success = (e, t) => L(e, E.DEFAULT, {
  ...t,
  type: E.SUCCESS
});
l.loading = (e, t) => L(e, E.DEFAULT, J(t, Te));
l.dark = (e, t) => L(e, E.DEFAULT, J(t, {
  theme: q.DARK
}));
l.remove = (e) => {
  e ? y.dismiss(e) : y.clear();
};
l.clearAll = (e, t) => {
  ie(() => {
    y.clear(e, t);
  });
};
l.isActive = (e) => {
  let t = !1;
  return t = he().findIndex((a) => a.toastId === e) > -1, t;
};
l.update = (e, t = {}) => {
  setTimeout(() => {
    const n = Ge(e);
    if (n) {
      const a = h(n), {
        content: o
      } = a, s = {
        ...a,
        ...t,
        toastId: t.toastId || e,
        updateId: ve()
      }, d = s.render || o;
      delete s.render, L(d, s.type, s);
    }
  }, 0);
};
l.done = (e) => {
  l.update(e, {
    isLoading: !1,
    progress: 1
  });
};
l.promise = vt;
function vt(e, {
  pending: t,
  error: n,
  success: a
}, o) {
  var v, i, m;
  let s;
  const d = {
    ...o || {},
    autoClose: !1
  };
  t && (s = re(t) ? l.loading(t, d) : l.loading(t.render, {
    ...d,
    ...t
  }));
  const C = {
    autoClose: (v = o == null ? void 0 : o.autoClose) != null ? v : !0,
    closeOnClick: (i = o == null ? void 0 : o.closeOnClick) != null ? i : !0,
    closeButton: (m = o == null ? void 0 : o.autoClose) != null ? m : null,
    isLoading: void 0,
    draggable: null,
    delay: 100
  }, c = (T, N, A) => {
    if (N == null) {
      l.remove(s);
      return;
    }
    const I = {
      type: T,
      ...C,
      ...o,
      data: A
    }, F = re(N) ? {
      render: N
    } : N;
    return s ? l.update(s, {
      ...I,
      ...F,
      isLoading: !1
    }) : l(F.render, {
      ...I,
      ...F,
      isLoading: !1
    }), A;
  }, _ = B(e) ? e() : e;
  return _.then((T) => {
    c("success", a, T);
  }).catch((T) => {
    c("error", n, T);
  }), _;
}
l.POSITION = H;
l.THEME = q;
l.TYPE = E;
l.TRANSITIONS = Ie;
const St = {
  install(e, t = {}) {
    Ve.useHandler = t.useHandler || (() => {
    }), pt(t);
  }
};
typeof window < "u" && (window.Vue3Toastify = St);
function pt(e = {}) {
  const t = J(ge, e);
  Qe(t);
}
export {
  W as AnimationStep,
  be as Bounce,
  we as Flip,
  Le as Slide,
  y as ToastActions,
  Et as ToastifyContainer,
  $e as Zoom,
  Ce as addExitAnimateToNode,
  Ve as appInstance,
  ze as appendFromQueue,
  xe as cacheRenderInstance,
  Ue as clearContainers,
  k as containerInstances,
  St as default,
  G as doAppend,
  R as getAllToast,
  Ge as getToast,
  K as globalCache,
  ye as globalOptions,
  p as queue,
  oe as removeContainer,
  l as toast,
  f as toastContainers,
  pt as updateGlobalOptions,
  lt as useCssTransition
};

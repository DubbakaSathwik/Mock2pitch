/* @ds-bundle: {"format":4,"namespace":"Mock2PitchDesignSystem_feb8de","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"ProgressBar","sourcePath":"components/feedback/ProgressBar.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"FileDropzone","sourcePath":"components/forms/FileDropzone.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"FeedbackItem","sourcePath":"components/pitch/FeedbackItem.jsx"},{"name":"LevelMeter","sourcePath":"components/pitch/LevelMeter.jsx"},{"name":"MetricCard","sourcePath":"components/pitch/MetricCard.jsx"},{"name":"RecordButton","sourcePath":"components/pitch/RecordButton.jsx"},{"name":"ScoreRing","sourcePath":"components/pitch/ScoreRing.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"870e423c952f","components/core/Button.jsx":"7c8b38b1f31b","components/core/Card.jsx":"61efdf01a1ac","components/core/Icon.jsx":"115b4aaa7c3e","components/core/IconButton.jsx":"e47064474757","components/feedback/Dialog.jsx":"8e55b2d1a29e","components/feedback/ProgressBar.jsx":"3bef2d96058a","components/feedback/Toast.jsx":"8aa146f7d632","components/feedback/Tooltip.jsx":"a572633af0f6","components/forms/Checkbox.jsx":"39a898b9fbfb","components/forms/FileDropzone.jsx":"f97afcbe7781","components/forms/Input.jsx":"e92f12335407","components/forms/Radio.jsx":"4059ffb25ed5","components/forms/Select.jsx":"eb2267593ecf","components/forms/Switch.jsx":"0075916f6feb","components/navigation/Tabs.jsx":"01d070c699d6","components/pitch/FeedbackItem.jsx":"00d08a148341","components/pitch/LevelMeter.jsx":"18a47cd01030","components/pitch/MetricCard.jsx":"dfddfa5a32a6","components/pitch/RecordButton.jsx":"193969acc220","components/pitch/ScoreRing.jsx":"a46759949af2","ui_kits/web-app/Dashboard.jsx":"3c738d6d40ff","ui_kits/web-app/Practice.jsx":"d268c186371e","ui_kits/web-app/Report.jsx":"5cf3aed75e8e","ui_kits/web-app/Setup.jsx":"2ffc2c0d4fa7","ui_kits/web-app/Sidebar.jsx":"7ed9d2b3d742","ui_kits/web-app/data.js":"70686c3a6634"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.Mock2PitchDesignSystem_feb8de = window.Mock2PitchDesignSystem_feb8de || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const T = {
  neutral: ['var(--ink-100)', 'var(--ink-700)'],
  info: ['var(--marine-50)', 'var(--marine-600)'],
  success: ['var(--success-50)', 'var(--success-500)'],
  warning: ['var(--warning-50)', '#9A6106'],
  danger: ['var(--danger-50)', 'var(--danger-500)'],
  violet: ['var(--pitch-violet-soft)', '#5B30D9'],
  solid: ['var(--imperial-blue)', 'var(--white)']
};
function Badge({
  tone = 'neutral',
  dot,
  children,
  style,
  ...rest
}) {
  const [bg, fg] = T[tone] || T.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 24,
      padding: '0 10px',
      borderRadius: 'var(--radius-pill)',
      background: bg,
      color: fg,
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: 12.5,
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: 'currentColor'
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  variant = 'default',
  padding = 24,
  interactive,
  children,
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const base = {
    default: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-sm)'
    },
    sunken: {
      background: 'var(--surface-sunken)',
      border: '1px solid transparent',
      boxShadow: 'none'
    },
    inverse: {
      background: 'var(--surface-inverse)',
      border: '1px solid transparent',
      boxShadow: 'none',
      color: 'var(--text-on-inverse)'
    },
    accent: {
      background: 'var(--surface-accent-soft)',
      border: '1px solid var(--marine-100)',
      boxShadow: 'none'
    }
  }[variant];
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      borderRadius: 'var(--radius-lg)',
      padding,
      ...base,
      ...(interactive && h ? {
        boxShadow: 'var(--shadow-md)',
        transform: 'translateY(-1px)',
        cursor: 'pointer'
      } : {}),
      transition: 'box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const HREF = (document.currentScript && document.currentScript.dataset.icons) || 'vendor/lucide/lucide.css';
function ensure() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-m2p-icons]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = HREF;
  l.setAttribute('data-m2p-icons', '');
  document.head.appendChild(l);
}
function Icon({
  name,
  size = 20,
  color = 'currentColor',
  style,
  ...rest
}) {
  ensure();
  return /*#__PURE__*/React.createElement("i", _extends({
    className: 'icon-' + name,
    "aria-hidden": "true",
    style: {
      fontSize: size,
      lineHeight: 1,
      color,
      display: 'inline-flex',
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
      fontStyle: 'normal',
      flexShrink: 0,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    h: 36,
    px: 14,
    fs: 14,
    ic: 16
  },
  md: {
    h: 44,
    px: 20,
    fs: 15,
    ic: 18
  },
  lg: {
    h: 52,
    px: 26,
    fs: 17,
    ic: 20
  }
};
const V = {
  primary: {
    bg: 'var(--action-primary)',
    hover: 'var(--action-primary-hover)',
    press: 'var(--action-primary-press)',
    fg: 'var(--white)',
    bd: 'transparent'
  },
  accent: {
    bg: 'var(--action-accent)',
    hover: 'var(--action-accent-hover)',
    press: 'var(--marine-700)',
    fg: 'var(--white)',
    bd: 'transparent'
  },
  secondary: {
    bg: 'var(--white)',
    hover: 'var(--marine-50)',
    press: 'var(--marine-100)',
    fg: 'var(--imperial-blue)',
    bd: 'var(--border-strong)'
  },
  ghost: {
    bg: 'transparent',
    hover: 'var(--ink-100)',
    press: 'var(--ink-200)',
    fg: 'var(--imperial-blue)',
    bd: 'transparent'
  },
  record: {
    bg: 'var(--danger-500)',
    hover: '#C03A3A',
    press: '#A93232',
    fg: 'var(--white)',
    bd: 'transparent'
  },
  inverse: {
    bg: 'var(--icy-blue)',
    hover: '#C4ECFC',
    press: '#8FD5F3',
    fg: 'var(--prussian-blue)',
    bd: 'transparent'
  }
};
function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  fullWidth,
  disabled,
  children,
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const [p, setP] = React.useState(false);
  const v = V[variant] || V.primary;
  const s = SIZES[size] || SIZES.md;
  const bg = disabled ? 'var(--ink-200)' : p ? v.press : h ? v.hover : v.bg;
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => {
      setH(false);
      setP(false);
    },
    onMouseDown: () => setP(true),
    onMouseUp: () => setP(false),
    style: {
      display: fullWidth ? 'flex' : 'inline-flex',
      width: fullWidth ? '100%' : undefined,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: s.h,
      padding: '0 ' + s.px + 'px',
      borderRadius: 'var(--radius-pill)',
      border: '1px solid ' + (disabled ? 'transparent' : v.bd),
      background: bg,
      color: disabled ? 'var(--ink-400)' : v.fg,
      fontFamily: 'var(--font-display)',
      fontSize: s.fs,
      letterSpacing: '.01em',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transform: p && !disabled ? 'scale(.97)' : 'none',
      transition: 'background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), iconLeft && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconLeft,
    size: s.ic
  }), children, iconRight && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: s.ic
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 40,
  disabled,
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const map = {
    ghost: ['transparent', 'var(--ink-100)', 'var(--ink-700)', 'transparent'],
    secondary: ['var(--white)', 'var(--marine-50)', 'var(--imperial-blue)', 'var(--border-strong)'],
    primary: ['var(--action-primary)', 'var(--action-primary-hover)', 'var(--white)', 'transparent'],
    inverse: ['rgba(166,225,250,.12)', 'rgba(166,225,250,.22)', 'var(--icy-blue)', 'transparent']
  };
  const [bg, hv, fg, bd] = map[variant] || map.ghost;
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label,
    title: label,
    disabled: disabled,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      width: size,
      height: size,
      borderRadius: 'var(--radius-pill)',
      border: '1px solid ' + bd,
      background: h && !disabled ? hv : bg,
      color: disabled ? 'var(--ink-400)' : fg,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background var(--dur-fast) var(--ease-out)',
      padding: 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: Math.round(size * 0.48)
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open = true,
  title,
  children,
  actions,
  onClose,
  width = 480,
  inline,
  style
}) {
  if (!open) return null;
  const panel = /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    style: {
      width,
      maxWidth: '100%',
      background: 'var(--white)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-lg)',
      padding: 28,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      flex: 1,
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 400,
      fontSize: 22,
      color: 'var(--text-strong)'
    }
  }, title), onClose && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "x",
    label: "Close",
    size: 32,
    onClick: onClose
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-body)',
      fontSize: 16,
      lineHeight: 1.6
    }
  }, children), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 4
    }
  }, actions));
  if (inline) return panel;
  return /*#__PURE__*/React.createElement("div", {
    onClick: e => {
      if (e.target === e.currentTarget && onClose) onClose();
    },
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,7,45,.45)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      zIndex: 100
    }
  }, panel);
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ProgressBar.jsx
try { (() => {
const C = {
  marine: 'var(--bright-marine)',
  success: 'var(--success-500)',
  warning: 'var(--warning-500)',
  danger: 'var(--danger-500)',
  navy: 'var(--imperial-blue)'
};
function ProgressBar({
  value = 0,
  max = 100,
  tone = 'marine',
  height = 8,
  label,
  valueLabel,
  style
}) {
  const pct = Math.max(0, Math.min(100, value / max * 100));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, (label || valueLabel) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: 'var(--text-strong)'
    }
  }, valueLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      height,
      borderRadius: height,
      background: 'var(--ink-100)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: pct + '%',
      height: '100%',
      borderRadius: height,
      background: C[tone] || tone,
      transition: 'width var(--dur-slow) var(--ease-out)'
    }
  })));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
const T = {
  info: ['info', 'var(--bright-marine)'],
  success: ['circle-check', 'var(--success-500)'],
  warning: ['triangle-alert', 'var(--warning-500)'],
  danger: ['circle-x', 'var(--danger-500)']
};
function Toast({
  tone = 'info',
  title,
  children,
  onClose,
  style
}) {
  const [ic, c] = T[tone] || T.info;
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      width: 360,
      maxWidth: '100%',
      padding: '14px 16px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--prussian-blue)',
      color: 'var(--white)',
      boxShadow: 'var(--shadow-lg)',
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: ic,
    size: 20,
    color: tone === 'info' ? 'var(--icy-blue)' : c,
    style: {
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, title && /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 15
    }
  }, title), children && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--icy-blue)'
    }
  }, children)), onClose && /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Dismiss",
    style: {
      border: 'none',
      background: 'transparent',
      color: 'var(--ink-300)',
      cursor: 'pointer',
      padding: 2
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 16
  })));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip({
  content,
  placement = 'top',
  children
}) {
  const [o, setO] = React.useState(false);
  const pos = placement === 'bottom' ? {
    top: 'calc(100% + 8px)'
  } : {
    bottom: 'calc(100% + 8px)'
  };
  return /*#__PURE__*/React.createElement("span", {
    onMouseEnter: () => setO(true),
    onMouseLeave: () => setO(false),
    onFocus: () => setO(true),
    onBlur: () => setO(false),
    style: {
      position: 'relative',
      display: 'inline-flex'
    }
  }, children, /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%) translateY(' + (o ? 0 : 4) + 'px)',
      ...pos,
      opacity: o ? 1 : 0,
      pointerEvents: 'none',
      transition: 'opacity var(--dur-fast), transform var(--dur-fast) var(--ease-out)',
      background: 'var(--prussian-blue)',
      color: 'var(--white)',
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      lineHeight: 1.4,
      padding: '6px 10px',
      borderRadius: 8,
      whiteSpace: 'nowrap',
      boxShadow: 'var(--shadow-md)',
      zIndex: 20
    }
  }, content));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1,
      fontFamily: 'var(--font-body)',
      fontSize: 15,
      color: 'var(--text-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 20,
      height: 20,
      borderRadius: 6,
      border: '1.5px solid ' + (checked ? 'var(--imperial-blue)' : 'var(--border-strong)'),
      background: checked ? 'var(--imperial-blue)' : 'var(--white)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      transition: 'all var(--dur-fast)'
    }
  }, checked && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 14,
    color: "var(--white)"
  })), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/FileDropzone.jsx
try { (() => {
function FileDropzone({
  title = 'Drop your slides here',
  hint = 'PDF or PPTX, up to 50 MB',
  file,
  onSelect,
  onClear,
  style
}) {
  const [over, setOver] = React.useState(false);
  const ref = React.useRef(null);
  if (file) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--white)',
        ...style
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 44,
        height: 44,
        borderRadius: 12,
        background: 'var(--marine-50)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "file-text",
      size: 22,
      color: "var(--bright-marine)"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: 'var(--text-strong)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, file.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--text-muted)'
      }
    }, file.meta)), onClear && /*#__PURE__*/React.createElement("button", {
      onClick: onClear,
      "aria-label": "Remove file",
      style: {
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        color: 'var(--ink-500)',
        padding: 6
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "x",
      size: 18
    })));
  }
  return /*#__PURE__*/React.createElement("div", {
    onClick: () => ref.current && ref.current.click(),
    onDragOver: e => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: e => {
      e.preventDefault();
      setOver(false);
      const f = e.dataTransfer.files[0];
      f && onSelect && onSelect(f);
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      padding: '36px 24px',
      borderRadius: 'var(--radius-lg)',
      border: '2px dashed ' + (over ? 'var(--bright-marine)' : 'var(--marine-200)'),
      background: over ? 'var(--marine-100)' : 'var(--marine-50)',
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'all var(--dur-base) var(--ease-out)',
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 26,
      background: 'var(--white)',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "upload",
    size: 24,
    color: "var(--bright-marine)"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 17,
      color: 'var(--text-strong)'
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, hint), /*#__PURE__*/React.createElement("input", {
    ref: ref,
    type: "file",
    accept: ".pdf,.ppt,.pptx",
    hidden: true,
    onChange: e => {
      const f = e.target.files[0];
      f && onSelect && onSelect(f);
    }
  }));
}
Object.assign(__ds_scope, { FileDropzone });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FileDropzone.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  label,
  hint,
  error,
  icon,
  id,
  style,
  ...rest
}) {
  const [f, setF] = React.useState(false);
  const iid = id || React.useId();
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: iid,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--text-strong)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 44,
      padding: '0 14px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--white)',
      border: '1px solid ' + (error ? 'var(--danger-500)' : f ? 'var(--border-focus)' : 'var(--border-strong)'),
      boxShadow: f ? error ? '0 0 0 3px rgba(214,69,69,.2)' : 'var(--focus-ring)' : 'none',
      transition: 'box-shadow var(--dur-fast), border-color var(--dur-fast)'
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18,
    color: "var(--ink-500)"
  }), /*#__PURE__*/React.createElement("input", _extends({
    id: iid,
    onFocus: () => setF(true),
    onBlur: () => setF(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontFamily: 'var(--font-body)',
      fontSize: 16,
      color: 'var(--text-strong)'
    }
  }, rest))), (error || hint) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: error ? 'var(--danger-500)' : 'var(--text-muted)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function Radio({
  checked,
  onChange,
  label,
  name,
  value,
  disabled,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1,
      fontFamily: 'var(--font-body)',
      fontSize: 15,
      color: 'var(--text-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(value),
    style: {
      width: 20,
      height: 20,
      borderRadius: 10,
      border: '1.5px solid ' + (checked ? 'var(--imperial-blue)' : 'var(--border-strong)'),
      background: 'var(--white)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, checked && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 5,
      background: 'var(--imperial-blue)'
    }
  })), label);
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  label,
  options = [],
  value,
  onChange,
  id,
  style,
  ...rest
}) {
  const iid = id || React.useId();
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: iid,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--text-strong)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: iid,
    value: value,
    onChange: onChange,
    style: {
      appearance: 'none',
      WebkitAppearance: 'none',
      width: '100%',
      height: 44,
      padding: '0 40px 0 14px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-strong)',
      background: 'var(--white)',
      fontFamily: 'var(--font-body)',
      fontSize: 16,
      color: 'var(--text-strong)',
      cursor: 'pointer'
    }
  }, rest), options.map(o => typeof o === 'string' ? /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o) : /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 18,
    color: "var(--ink-500)",
    style: {
      position: 'absolute',
      right: 14,
      top: 13,
      pointerEvents: 'none'
    }
  })));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  checked,
  onChange,
  label,
  disabled,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1,
      fontFamily: 'var(--font-body)',
      fontSize: 15,
      color: 'var(--text-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    role: "switch",
    "aria-checked": !!checked,
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 40,
      height: 24,
      borderRadius: 12,
      background: checked ? 'var(--bright-marine)' : 'var(--ink-300)',
      position: 'relative',
      transition: 'background var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: checked ? 19 : 3,
      width: 18,
      height: 18,
      borderRadius: 9,
      background: 'var(--white)',
      boxShadow: 'var(--shadow-sm)',
      transition: 'left var(--dur-base) var(--ease-out)'
    }
  })), label);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  items = [],
  value,
  onChange,
  variant = 'segmented',
  style
}) {
  if (variant === 'underline') {
    return /*#__PURE__*/React.createElement("div", {
      role: "tablist",
      style: {
        display: 'flex',
        gap: 24,
        borderBottom: '1px solid var(--border-subtle)',
        ...style
      }
    }, items.map(it => {
      const id = it.value || it;
      const on = id === value;
      return /*#__PURE__*/React.createElement("button", {
        key: id,
        role: "tab",
        "aria-selected": on,
        onClick: () => onChange && onChange(id),
        style: {
          border: 'none',
          background: 'transparent',
          padding: '10px 0',
          marginBottom: -1,
          borderBottom: '2px solid ' + (on ? 'var(--bright-marine)' : 'transparent'),
          color: on ? 'var(--text-strong)' : 'var(--text-muted)',
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          cursor: 'pointer'
        }
      }, it.label || it);
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'inline-flex',
      gap: 4,
      padding: 4,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--ink-100)',
      ...style
    }
  }, items.map(it => {
    const id = it.value || it;
    const on = id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(id),
      style: {
        border: 'none',
        height: 36,
        padding: '0 16px',
        borderRadius: 'var(--radius-pill)',
        background: on ? 'var(--white)' : 'transparent',
        boxShadow: on ? 'var(--shadow-sm)' : 'none',
        color: on ? 'var(--text-strong)' : 'var(--text-muted)',
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        cursor: 'pointer',
        transition: 'all var(--dur-fast)'
      }
    }, it.label || it);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/pitch/FeedbackItem.jsx
try { (() => {
const T = {
  good: ['circle-check', 'var(--success-500)', 'var(--success-50)'],
  tip: ['lightbulb', 'var(--bright-marine)', 'var(--marine-50)'],
  fix: ['triangle-alert', 'var(--warning-500)', 'var(--warning-50)']
};
function FeedbackItem({
  kind = 'tip',
  title,
  children,
  meta,
  style
}) {
  const [ic, c, bg] = T[kind] || T.tip;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      padding: '14px 0',
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 36,
      flexShrink: 0,
      borderRadius: 18,
      background: bg,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: ic,
    size: 18,
    color: c
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'baseline',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 16,
      color: 'var(--text-strong)'
    }
  }, title), meta && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, meta)), children && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      lineHeight: 1.55,
      color: 'var(--text-body)'
    }
  }, children)));
}
Object.assign(__ds_scope, { FeedbackItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pitch/FeedbackItem.jsx", error: String((e && e.message) || e) }); }

// components/pitch/LevelMeter.jsx
try { (() => {
function LevelMeter({
  levels = [],
  active = true,
  color = 'var(--bright-marine)',
  height = 48,
  barWidth = 4,
  gap = 3,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap,
      height,
      ...style
    }
  }, levels.map((l, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: barWidth,
      height: Math.max(barWidth, l * height),
      borderRadius: barWidth,
      background: active ? color : 'var(--ink-300)',
      transition: 'height 90ms linear'
    }
  })));
}
Object.assign(__ds_scope, { LevelMeter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pitch/LevelMeter.jsx", error: String((e && e.message) || e) }); }

// components/pitch/MetricCard.jsx
try { (() => {
function MetricCard({
  icon,
  label,
  value,
  unit,
  caption,
  status,
  statusTone = 'neutral',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      fontFamily: 'var(--font-body)',
      minWidth: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 10,
      background: 'var(--marine-50)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 17,
    color: "var(--bright-marine)"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--text-body)'
    }
  }, label), status && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: statusTone
  }, status)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-metric)',
      lineHeight: 1,
      color: 'var(--text-strong)'
    }
  }, value), unit && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: 'var(--text-muted)'
    }
  }, unit)), caption && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, caption));
}
Object.assign(__ds_scope, { MetricCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pitch/MetricCard.jsx", error: String((e && e.message) || e) }); }

// components/pitch/RecordButton.jsx
try { (() => {
function RecordButton({
  recording,
  onToggle,
  size = 88,
  style
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    "aria-label": recording ? 'Stop recording' : 'Start recording',
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      background: recording ? 'var(--danger-500)' : h ? 'var(--action-primary-hover)' : 'var(--action-primary)',
      color: 'var(--white)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: recording ? '0 0 0 8px rgba(214,69,69,.18), 0 0 0 18px rgba(214,69,69,.08)' : '0 0 0 8px rgba(14,107,168,.14)',
      transition: 'all var(--dur-base) var(--ease-out)',
      ...style
    }
  }, recording ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: size * .3,
      height: size * .3,
      borderRadius: 6,
      background: 'var(--white)'
    }
  }) : /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "mic",
    size: Math.round(size * .38)
  }));
}
Object.assign(__ds_scope, { RecordButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pitch/RecordButton.jsx", error: String((e && e.message) || e) }); }

// components/pitch/ScoreRing.jsx
try { (() => {
function ScoreRing({
  value = 0,
  size = 140,
  stroke = 12,
  label = 'Confidence',
  color = 'var(--bright-marine)',
  track = 'var(--ink-100)',
  textColor = 'var(--text-strong)',
  style
}) {
  const r = (size - stroke) / 2,
    c = 2 * Math.PI * r,
    off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size,
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    style: {
      transform: 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: track,
    strokeWidth: stroke
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: off,
    style: {
      transition: 'stroke-dashoffset var(--dur-slow) var(--ease-out)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: size * .28,
      lineHeight: 1,
      color: textColor
    }
  }, value), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: Math.max(11, size * .095),
      color: textColor,
      opacity: .75,
      marginTop: 4
    }
  }, label)));
}
Object.assign(__ds_scope, { ScoreRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pitch/ScoreRing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/Dashboard.jsx
try { (() => {
const {
  Button: DbButton,
  Card: DbCard,
  Badge: DbBadge,
  Icon: DbIcon,
  MetricCard: DbMetric
} = window.Mock2PitchDesignSystem_feb8de;
function Dashboard({
  go
}) {
  const D = window.M2P_DATA;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 260
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 32
    }
  }, "Hi ", D.user.name, ", ready to rehearse?"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-muted)',
      marginTop: 6,
      fontSize: 17
    }
  }, "Upload your slides, hit record, and get a report in under a minute.")), /*#__PURE__*/React.createElement(DbButton, {
    size: "lg",
    iconLeft: "mic",
    onClick: () => go('setup')
  }, "New practice")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(DbMetric, {
    icon: "sparkles",
    label: "Average score",
    value: "74",
    caption: "Up 9 from last week",
    status: "Improving",
    statusTone: "success"
  }), /*#__PURE__*/React.createElement(DbMetric, {
    icon: "message-square-warning",
    label: "Fillers per min",
    value: "1.6",
    caption: "Goal: under 1.0",
    status: "Watch",
    statusTone: "warning"
  }), /*#__PURE__*/React.createElement(DbMetric, {
    icon: "timer",
    label: "Practice time",
    value: "42",
    unit: "min",
    caption: "Across 9 runs"
  })), /*#__PURE__*/React.createElement(DbCard, {
    padding: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: '18px 24px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      flex: 1,
      fontSize: 19
    }
  }, "Recent practice runs"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
    },
    style: {
      fontSize: 14
    }
  }, "View all")), D.sessions.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    onClick: () => go('report'),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '16px 24px',
      borderTop: i ? '1px solid var(--border-subtle)' : 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 12,
      background: 'var(--marine-50)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(DbIcon, {
    name: "presentation",
    color: "var(--bright-marine)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: 'var(--text-strong)'
    }
  }, s.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, s.type, " \xB7 ", s.date, " \xB7 ", s.dur)), s.trend && /*#__PURE__*/React.createElement(DbBadge, {
    tone: "success"
  }, s.trend), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 24,
      color: 'var(--text-strong)',
      width: 44,
      textAlign: 'right'
    }
  }, s.score), /*#__PURE__*/React.createElement(DbIcon, {
    name: "chevron-right",
    color: "var(--ink-400)"
  })))));
}
window.Dashboard = Dashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/Practice.jsx
try { (() => {
const {
  Button: PrButton,
  IconButton: PrIconBtn,
  Badge: PrBadge,
  Icon: PrIcon,
  RecordButton: PrRecord,
  LevelMeter: PrMeter,
  Checkbox: PrCheck
} = window.Mock2PitchDesignSystem_feb8de;
function fmt(s) {
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function Practice({
  go
}) {
  const D = window.M2P_DATA;
  const [rec, setRec] = React.useState(false);
  const [t, setT] = React.useState(0);
  const [slide, setSlide] = React.useState(0);
  const [lv, setLv] = React.useState(Array(28).fill(.15));
  const [done, setDone] = React.useState({});
  React.useEffect(() => {
    if (!rec) return;
    const a = setInterval(() => setT(x => x + 1), 1000);
    const b = setInterval(() => setLv(Array.from({
      length: 28
    }, () => .15 + Math.random() * .85)), 120);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [rec]);
  const s = D.slides[slide];
  const target = 480;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--prussian-blue)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      height: 'var(--topbar-h)',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '0 24px',
      borderBottom: '1px solid rgba(166,225,250,.12)'
    }
  }, /*#__PURE__*/React.createElement(PrIconBtn, {
    icon: "arrow-left",
    label: "Back",
    variant: "inverse",
    onClick: () => go('setup')
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 16,
      flex: 1
    }
  }, "Smart Irrigation \u2014 Final Review"), rec && /*#__PURE__*/React.createElement(PrBadge, {
    tone: "danger",
    dot: true
  }, "Recording"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 22,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, fmt(t), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--icy-blue)',
      fontSize: 15
    }
  }, " / ", fmt(target)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 320px',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 28,
      padding: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 720,
      aspectRatio: '16/9',
      background: '#fff',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 8%',
      color: 'var(--prussian-blue)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--ink-500)'
    }
  }, "Slide ", s.n, " of ", D.slides.length), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 34,
      lineHeight: 1.15,
      marginTop: 6
    }
  }, s.title)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(PrIconBtn, {
    icon: "chevron-left",
    label: "Previous slide",
    variant: "inverse",
    size: 48,
    disabled: slide === 0,
    onClick: () => setSlide(slide - 1)
  }), /*#__PURE__*/React.createElement(PrRecord, {
    recording: rec,
    onToggle: () => setRec(!rec)
  }), /*#__PURE__*/React.createElement(PrIconBtn, {
    icon: "chevron-right",
    label: "Next slide",
    variant: "inverse",
    size: 48,
    disabled: slide === D.slides.length - 1,
    onClick: () => setSlide(slide + 1)
  })), /*#__PURE__*/React.createElement(PrMeter, {
    levels: lv,
    active: rec,
    color: "var(--icy-blue)",
    height: 40
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: 'var(--icy-blue)'
    }
  }, rec ? 'Speak naturally. Use the arrows to move through your slides.' : 'Press the mic when you\'re ready. Take a breath first.')), /*#__PURE__*/React.createElement("aside", {
    style: {
      background: 'var(--deep-navy)',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 12,
      letterSpacing: '.24em',
      color: 'var(--icy-blue)'
    }
  }, "COVER ON THIS SLIDE"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, s.points.map(p => {
    const k = s.n + p;
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        background: 'var(--imperial-blue)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px'
      }
    }, /*#__PURE__*/React.createElement(PrCheck, {
      checked: !!done[k],
      onChange: v => setDone({
        ...done,
        [k]: v
      }),
      label: /*#__PURE__*/React.createElement("span", {
        style: {
          color: '#fff',
          flex: 1
        }
      }, p),
      style: {
        width: '100%',
        alignItems: 'flex-start'
      }
    }));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 14,
      color: 'var(--icy-blue)'
    }
  }, /*#__PURE__*/React.createElement(PrIcon, {
    name: "gauge",
    size: 18
  }), "Pace ", rec ? '152 wpm · steady' : '—'), /*#__PURE__*/React.createElement(PrButton, {
    variant: "inverse",
    fullWidth: true,
    iconLeft: "square",
    disabled: t < 1,
    onClick: () => go('report')
  }, "Finish & analyse")))));
}
window.Practice = Practice;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/Practice.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/Report.jsx
try { (() => {
const {
  Button: RpButton,
  Card: RpCard,
  Badge: RpBadge,
  Tabs: RpTabs,
  MetricCard: RpMetric,
  ScoreRing: RpRing,
  ProgressBar: RpProgress,
  FeedbackItem: RpFeedback,
  Tooltip: RpTip,
  Icon: RpIcon
} = window.Mock2PitchDesignSystem_feb8de;
function Report({
  go
}) {
  const D = window.M2P_DATA;
  const [tab, setTab] = React.useState('Overview');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 260
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, "Project seminar \xB7 Today, 10:12"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 32,
      marginTop: 2
    }
  }, "Smart Irrigation \u2014 Final Review")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(RpButton, {
    variant: "secondary",
    iconLeft: "download"
  }, "Export PDF"), /*#__PURE__*/React.createElement(RpButton, {
    iconLeft: "rotate-ccw",
    onClick: () => go('practice')
  }, "Practice again"))), /*#__PURE__*/React.createElement(RpCard, {
    variant: "inverse",
    padding: 28,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 32,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(RpRing, {
    value: 82,
    size: 132,
    color: "var(--icy-blue)",
    track: "rgba(166,225,250,.15)",
    textColor: "#fff",
    label: "Overall"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 240,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: '#fff',
      fontSize: 24
    }
  }, "Clear and confident. Slow down in the middle."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--icy-blue)',
      fontSize: 16
    }
  }, "You covered 10 of 12 key points and finished 12 seconds under time. Your pace jumped on the architecture slide.")), /*#__PURE__*/React.createElement(RpBadge, {
    tone: "success"
  }, "+6 vs last run")), /*#__PURE__*/React.createElement(RpTabs, {
    items: ["Overview", "Voice", "Slides", "Script"],
    value: tab,
    onChange: setTab
  }), tab === 'Overview' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(RpMetric, {
    icon: "timer",
    label: "Timing",
    value: "7:48",
    unit: "/ 8:00",
    status: "On target",
    statusTone: "success"
  }), /*#__PURE__*/React.createElement(RpMetric, {
    icon: "gauge",
    label: "Pace",
    value: "154",
    unit: "wpm",
    status: "Good",
    statusTone: "success",
    caption: "Peak 186 on slide 4"
  }), /*#__PURE__*/React.createElement(RpMetric, {
    icon: "message-square-warning",
    label: "Filler words",
    value: "12",
    status: "Watch",
    statusTone: "warning",
    caption: "1.5 per minute"
  }), /*#__PURE__*/React.createElement(RpMetric, {
    icon: "list-checks",
    label: "Coverage",
    value: "10",
    unit: "/ 12",
    status: "2 missed",
    statusTone: "info"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)',
      gap: 16,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(RpCard, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 19,
      marginBottom: 4
    }
  }, "Coaching notes"), D.feedback.map((f, i) => /*#__PURE__*/React.createElement(RpFeedback, {
    key: i,
    kind: f.kind,
    title: f.title,
    meta: f.meta,
    style: {
      borderTop: i ? '1px solid var(--border-subtle)' : 'none'
    }
  }, f.text))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(RpCard, {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 19,
      flex: 1
    }
  }, "Filler words"), /*#__PURE__*/React.createElement(RpTip, {
    content: "Counted from your transcript"
  }, /*#__PURE__*/React.createElement(RpIcon, {
    name: "info",
    size: 18,
    color: "var(--ink-400)"
  }))), D.fillers.map(([w, n]) => /*#__PURE__*/React.createElement(RpProgress, {
    key: w,
    value: n,
    max: 6,
    tone: "warning",
    label: '“' + w + '”',
    valueLabel: n
  }))), /*#__PURE__*/React.createElement(RpCard, {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 19
    }
  }, "Slide coverage"), D.slides.map((s, i) => /*#__PURE__*/React.createElement(RpProgress, {
    key: s.n,
    value: i === 4 ? 1 : i === 5 ? 1 : 2,
    max: 2,
    tone: i >= 4 ? 'warning' : 'success',
    label: s.n + '. ' + s.title,
    valueLabel: (i >= 4 ? 1 : 2) + ' / 2',
    height: 6
  })))))), tab !== 'Overview' && /*#__PURE__*/React.createElement(RpCard, {
    variant: "sunken",
    padding: 40,
    style: {
      textAlign: 'center',
      color: 'var(--text-muted)'
    }
  }, tab, " detail view is not part of this kit yet."));
}
window.Report = Report;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/Report.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/Setup.jsx
try { (() => {
const {
  Button: SuButton,
  Card: SuCard,
  Badge: SuBadge,
  Icon: SuIcon,
  Input: SuInput,
  Select: SuSelect,
  FileDropzone: SuDrop,
  ProgressBar: SuProgress,
  Switch: SuSwitch,
  Checkbox: SuCheck
} = window.Mock2PitchDesignSystem_feb8de;
function Setup({
  go
}) {
  const D = window.M2P_DATA;
  const [file, setFile] = React.useState(null);
  const [pct, setPct] = React.useState(0);
  const [hints, setHints] = React.useState(true);
  const [fill, setFill] = React.useState(true);
  React.useEffect(() => {
    if (!file || pct >= 100) return;
    const t = setTimeout(() => setPct(p => Math.min(100, p + 20)), 220);
    return () => clearTimeout(t);
  }, [file, pct]);
  const pick = () => {
    setFile({
      name: 'Smart-Irrigation-Final.pptx',
      meta: '6 slides · 3.1 MB'
    });
    setPct(0);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      maxWidth: 980
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 32
    }
  }, "New practice"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-muted)',
      marginTop: 6,
      fontSize: 17
    }
  }, "We'll read your slides and pull out the points you should cover.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)',
      gap: 20,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(SuCard, {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 19
    }
  }, "1. Your slides"), file ? /*#__PURE__*/React.createElement(SuDrop, {
    file: file,
    onClear: () => {
      setFile(null);
      setPct(0);
    }
  }) : /*#__PURE__*/React.createElement("div", {
    onClickCapture: e => {
      e.stopPropagation();
      pick();
    }
  }, /*#__PURE__*/React.createElement(SuDrop, null)), file && pct < 100 && /*#__PURE__*/React.createElement(SuProgress, {
    value: pct,
    label: "Extracting slides\u2026",
    valueLabel: pct + '%'
  }), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 19,
      marginTop: 4
    }
  }, "2. Details"), /*#__PURE__*/React.createElement(SuInput, {
    label: "Pitch title",
    defaultValue: "Smart Irrigation \u2014 Final Review"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(SuSelect, {
    label: "Pitch type",
    options: ["Project seminar", "Hackathon demo", "Campus placement"]
  }), /*#__PURE__*/React.createElement(SuInput, {
    label: "Target length",
    defaultValue: "8",
    hint: "Minutes",
    icon: "timer"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(SuSwitch, {
    checked: hints,
    onChange: setHints,
    label: "Live pace hints"
  }), /*#__PURE__*/React.createElement(SuCheck, {
    checked: fill,
    onChange: setFill,
    label: "Count filler words"
  }))), /*#__PURE__*/React.createElement(SuCard, {
    variant: file && pct >= 100 ? 'default' : 'sunken',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      flex: 1,
      fontSize: 19
    }
  }, "Key points"), file && pct >= 100 && /*#__PURE__*/React.createElement(SuBadge, {
    tone: "violet"
  }, "AI extracted")), file && pct >= 100 ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, D.slides.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.n,
    style: {
      display: 'flex',
      gap: 12,
      padding: '10px 0',
      borderTop: s.n > 1 ? '1px solid var(--border-subtle)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      color: 'var(--bright-marine)',
      width: 20
    }
  }, s.n), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: 'var(--text-strong)',
      fontSize: 15
    }
  }, s.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, s.points.join(' · ')))))) : /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 15
    }
  }, "Upload a deck to see the talking points for each slide."), /*#__PURE__*/React.createElement(SuButton, {
    fullWidth: true,
    size: "lg",
    iconLeft: "mic",
    disabled: !(file && pct >= 100),
    onClick: () => go('practice')
  }, "Start practice"))));
}
window.Setup = Setup;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/Setup.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/Sidebar.jsx
try { (() => {
const {
  Icon: SbIcon
} = window.Mock2PitchDesignSystem_feb8de;
function Logo() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 150,
      height: 82,
      overflow: 'hidden',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo.jpeg",
    alt: "Mock 2 Pitch",
    style: {
      position: 'absolute',
      width: 181,
      left: -13,
      top: -40
    }
  }));
}
function Sidebar({
  screen,
  go
}) {
  const items = [['home', 'layout-dashboard', 'Dashboard'], ['setup', 'circle-plus', 'New practice'], ['report', 'chart-line', 'Reports'], ['history', 'history', 'History']];
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 'var(--sidebar-w)',
      flexShrink: 0,
      background: 'var(--white)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 16px 20px',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Logo, null), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, items.map(([id, ic, l]) => {
    const on = screen === id || id === 'setup' && screen === 'practice';
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => go(id === 'history' ? 'home' : id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 44,
        padding: '0 14px',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        background: on ? 'var(--marine-50)' : 'transparent',
        color: on ? 'var(--imperial-blue)' : 'var(--ink-600)',
        fontFamily: 'var(--font-display)',
        fontSize: 14.5,
        cursor: 'pointer',
        textAlign: 'left'
      }
    }, /*#__PURE__*/React.createElement(SbIcon, {
      name: ic,
      size: 19,
      color: on ? 'var(--bright-marine)' : 'var(--ink-500)'
    }), l);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      background: 'var(--prussian-blue)',
      borderRadius: 'var(--radius-lg)',
      padding: 18,
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 15
    }
  }, "Placement week"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      color: 'var(--icy-blue)',
      lineHeight: 1.45
    }
  }, "3 practice runs this week. One more before Friday.")));
}
window.Sidebar = Sidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/data.js
try { (() => {
window.M2P_DATA = {
  user: {
    name: 'Ananya',
    college: 'VIT Chennai'
  },
  sessions: [{
    id: 1,
    title: 'Smart Irrigation — Final Review',
    type: 'Project seminar',
    date: 'Today, 10:12',
    dur: '7:48',
    score: 82,
    trend: '+6'
  }, {
    id: 2,
    title: 'HackFest Demo: CampusEats',
    type: 'Hackathon demo',
    date: 'Sep 29',
    dur: '3:05',
    score: 76,
    trend: '+11'
  }, {
    id: 3,
    title: 'Infosys HR Round — Self intro',
    type: 'Campus placement',
    date: 'Sep 26',
    dur: '1:58',
    score: 65,
    trend: ''
  }],
  slides: [{
    n: 1,
    title: 'Smart Irrigation using IoT',
    points: ['Team & guide', 'Problem in one line']
  }, {
    n: 2,
    title: 'Problem statement',
    points: ['40% water wasted in flood irrigation', 'Farmers lack soil data']
  }, {
    n: 3,
    title: 'Proposed system',
    points: ['Soil-moisture sensors', 'ESP32 + cloud dashboard']
  }, {
    n: 4,
    title: 'Architecture',
    points: ['Sensor → MQTT → Firebase', 'Auto pump control']
  }, {
    n: 5,
    title: 'Results',
    points: ['32% less water in field test', 'Payback < 1 season']
  }, {
    n: 6,
    title: 'Future scope',
    points: ['Weather API', 'Regional-language app']
  }],
  fillers: [['um', 5], ['like', 4], ['basically', 2], ['so', 1]],
  feedback: [{
    kind: 'good',
    title: 'Strong opening',
    meta: '00:00 · Slide 1',
    text: 'You stated the problem in under 15 seconds. Keep that.'
  }, {
    kind: 'fix',
    title: 'Rushed the architecture',
    meta: '03:40 · Slide 4',
    text: 'You spoke at 186 wpm here. Pause after each block of the diagram.'
  }, {
    kind: 'tip',
    title: 'Missed a key point',
    meta: '05:12 · Slide 5',
    text: 'You didn\'t mention the payback period. It\'s your strongest number.'
  }, {
    kind: 'fix',
    title: 'Filler words cluster',
    meta: '06:30 · Slide 6',
    text: '7 of 12 fillers came in the last minute. Script your closing line.'
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.FileDropzone = __ds_scope.FileDropzone;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.FeedbackItem = __ds_scope.FeedbackItem;

__ds_ns.LevelMeter = __ds_scope.LevelMeter;

__ds_ns.MetricCard = __ds_scope.MetricCard;

__ds_ns.RecordButton = __ds_scope.RecordButton;

__ds_ns.ScoreRing = __ds_scope.ScoreRing;

})();

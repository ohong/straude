"use client";

import { useEffect, useRef } from "react";

const VS_SOURCE = `
  attribute vec4 aVertexPosition;
  void main() { gl_Position = aVertexPosition; }
`;

const FS_SOURCE = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;

  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;

    float gridScale = 80.0;
    vec2 gridPos = fract(st * gridScale);
    vec2 gridId = floor(st * gridScale);

    vec2 noisePos = gridId * 0.05;
    noisePos.y -= u_time * 0.2;
    noisePos.x -= u_time * 0.1;

    float n = snoise(noisePos) * 0.5 + 0.5;
    n = smoothstep(0.3, 0.7, n);

    float dist = distance(gridPos, vec2(0.5));
    float dotSize = 0.4 * n;
    float shape = 1.0 - smoothstep(dotSize - 0.05, dotSize + 0.05, dist);

    vec3 bgColor = vec3(0.02, 0.02, 0.02);
    vec3 dotColor = mix(vec3(0.3), vec3(0.875, 0.337, 0.122), n * 0.5);

    vec3 finalColor = mix(bgColor, dotColor, shape * 0.5);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function loadShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function HalftoneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("webgl");
    if (!ctx) return;

    // Rebind to non-null consts so the render closure doesn't need assertions
    const canvas = cvs;
    const gl = ctx;

    const vs = loadShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
    const fs = loadShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE);
    if (!vs || !fs) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const vertexPos = gl.getAttribLocation(program, "aVertexPosition");
    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]),
      gl.STATIC_DRAW
    );

    // Track dimensions via ResizeObserver instead of reading window size every frame
    let dw = canvas.clientWidth;
    let dh = canvas.clientHeight;
    const ro = new ResizeObserver(([entry]) => {
      dw = entry.contentRect.width;
      dh = entry.contentRect.height;
    });
    ro.observe(canvas);

    let raf: number;

    function render(now: number) {
      const t = now * 0.001;
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
        gl.viewport(0, 0, dw, dh);
      }
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(vertexPos, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(vertexPos);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    }

    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

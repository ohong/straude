import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Input } from "@/components/ui/Input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
  });

  it("error state adds error styling", () => {
    render(<Input error placeholder="Error input" />);
    const input = screen.getByPlaceholderText("Error input");
    expect(input.className).toContain("border-error");
  });

  it("normal state has border-border class", () => {
    render(<Input placeholder="Normal" />);
    const input = screen.getByPlaceholderText("Normal");
    expect(input.className).toContain("border-border");
    expect(input.className).not.toContain("border-error");
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} placeholder="Ref test" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current!.placeholder).toBe("Ref test");
  });

  it("fires onChange handler", () => {
    const handler = vi.fn();
    render(<Input onChange={handler} placeholder="Change test" />);
    fireEvent.change(screen.getByPlaceholderText("Change test"), {
      target: { value: "hello" },
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("accepts custom className", () => {
    render(<Input className="my-input" placeholder="Custom" />);
    const input = screen.getByPlaceholderText("Custom");
    expect(input.className).toContain("my-input");
  });
});

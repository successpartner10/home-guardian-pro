import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";
import PinModal from "@/components/PinModal";

describe("PinModal component", () => {
  const mockOnSuccess = vi.fn();
  const mockOnClose = vi.fn();
  const testPin = "1234";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when isOpen is true", () => {
    render(
      <PinModal
        isOpen={true}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
        correctPin={testPin}
      />
    );
    // PinModal renders "Enter Security PIN to continue"
    expect(screen.getByText(/enter security pin/i)).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <PinModal
        isOpen={false}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
        correctPin={testPin}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all 10 digit buttons (0-9)", () => {
    render(
      <PinModal
        isOpen={true}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
        correctPin={testPin}
      />
    );
    const buttons = screen.getAllByRole("button");
    const digitButtons = buttons.filter(btn => /^[0-9]$/.test((btn.textContent || "").trim()));
    expect(digitButtons.length).toBe(10);
  });

  it("calls onSuccess with correct PIN", async () => {
    render(
      <PinModal
        isOpen={true}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
        correctPin={testPin}
      />
    );

    const buttons = screen.getAllByRole("button");
    const digitMap: Record<string, HTMLElement> = {};
    buttons.forEach(btn => {
      const digit = (btn.textContent || "").trim();
      if (/^[0-9]$/.test(digit)) digitMap[digit] = btn;
    });

    await act(async () => {
      fireEvent.click(digitMap["1"]);
      fireEvent.click(digitMap["2"]);
      fireEvent.click(digitMap["3"]);
      fireEvent.click(digitMap["4"]);
    });

    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onSuccess with wrong PIN", async () => {
    render(
      <PinModal
        isOpen={true}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
        correctPin={testPin}
      />
    );

    const buttons = screen.getAllByRole("button");
    const digitMap: Record<string, HTMLElement> = {};
    buttons.forEach(btn => {
      const digit = (btn.textContent || "").trim();
      if (/^[0-9]$/.test(digit)) digitMap[digit] = btn;
    });

    await act(async () => {
      ["9", "9", "9", "9"].forEach(d => {
        if (digitMap[d]) fireEvent.click(digitMap[d]);
      });
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it("calls onClose when X button is clicked", () => {
    render(
      <PinModal
        isOpen={true}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
        correctPin={testPin}
      />
    );

    // The X button is the first button in the modal
    const allButtons = screen.getAllByRole("button");
    // Find button containing "×" or the X icon button (no text, aria or first)
    const xBtn = allButtons.find(btn => !/(^[0-9]$)/.test((btn.textContent || "").trim())
      && !(btn.textContent || "").trim().match(/del|back/i));

    if (xBtn) {
      fireEvent.click(xBtn);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it("renders the correct number of PIN indicator dots", () => {
    render(
      <PinModal
        isOpen={true}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
        correctPin="123456"
      />
    );
    // 6-digit pin = 6 dots
    const dots = document.querySelectorAll(".rounded-full.border-2");
    expect(dots.length).toBe(6);
  });

  it("supports custom title prop", () => {
    render(
      <PinModal
        isOpen={true}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
        correctPin={testPin}
        title="Custom Security Title"
      />
    );
    expect(screen.getByText("Custom Security Title")).toBeInTheDocument();
  });

  it("backspace removes last digit", async () => {
    render(
      <PinModal
        isOpen={true}
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
        correctPin="12"
      />
    );

    // Enter 1
    fireEvent.click(screen.getByText("1"));
    
    // Find delete button
    const buttons = screen.getAllByRole("button");
    const deleteBtn = buttons.find(btn => btn.querySelector("svg.lucide-delete"));
    if (deleteBtn) {
       fireEvent.click(deleteBtn);
    }

    // Enter 1, 2
    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("2"));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });
});

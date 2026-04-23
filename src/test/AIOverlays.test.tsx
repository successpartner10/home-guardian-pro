import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AIOverlays } from "@/components/AIOverlays";

describe("AIOverlays component", () => {
  it("renders nothing when isMonitoring is false", () => {
    const { container } = render(
      <AIOverlays isMonitoring={false} analysis={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders when isMonitoring is true with no analysis", () => {
    const { container } = render(
      <AIOverlays isMonitoring={true} analysis={null} />
    );
    // Should render the overlay container
    expect(container.firstChild).toBeTruthy();
  });

  it("renders analysis summary when present", () => {
    const analysis = {
      summary: "A person is walking in the hallway",
      detected_objects: [],
      risk_level: "low",
      tags: [],
    };
    render(<AIOverlays isMonitoring={true} analysis={analysis} />);
    expect(screen.getByText("A person is walking in the hallway")).toBeInTheDocument();
  });

  it("renders bounding boxes for detected objects", () => {
    const analysis = {
      summary: null,
      detected_objects: [
        { label: "PERSON", confidence: 0.95, box_2d: [100, 200, 300, 400] },
        { label: "CHAIR", confidence: 0.80, box_2d: [50, 50, 200, 200] },
      ],
      risk_level: "medium",
      tags: ["person"],
    };
    const { container } = render(
      <AIOverlays isMonitoring={true} analysis={analysis} />
    );
    // Should render bounding box divs
    const boxes = container.querySelectorAll(".absolute.border-\\[1\\.5px\\]");
    expect(boxes.length).toBeGreaterThan(0);
  });

  it("shows correct object count in sidebar", () => {
    const analysis = {
      summary: "Test summary",
      detected_objects: [
        { label: "PERSON", confidence: 0.9, box_2d: [0, 0, 100, 100] },
        { label: "BOOK", confidence: 0.7, box_2d: [10, 10, 50, 50] },
        { label: "COUCH", confidence: 0.85, box_2d: [200, 200, 400, 400] },
      ],
      risk_level: "low",
      tags: [],
    };
    render(<AIOverlays isMonitoring={true} analysis={analysis} />);
    // Object count "3" should appear in the sidebar
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("updates log when analysis changes with new objects", async () => {
    const analysis = {
      summary: "Scene updated",
      detected_objects: [
        { label: "BANANA", confidence: 0.6, box_2d: [0, 0, 50, 50] },
      ],
      risk_level: "low",
      tags: [],
    };
    render(<AIOverlays isMonitoring={true} analysis={analysis} />);
    // The log should contain the detected object label
    await waitFor(() => {
      expect(screen.getAllByText("BANANA").length).toBeGreaterThan(0);
    });
  });

  it("handles analysis with no box_2d gracefully", () => {
    const analysis = {
      summary: "Something detected",
      detected_objects: [
        { label: "PERSON", confidence: 0.9 }, // no box_2d
      ],
      risk_level: "high",
      tags: [],
    };
    expect(() => {
      render(<AIOverlays isMonitoring={true} analysis={analysis} />);
    }).not.toThrow();
  });

  it("hides sidebar on small viewport (applies mobile class)", () => {
    const analysis = {
      summary: "Test",
      detected_objects: [],
      risk_level: "low",
      tags: [],
    };
    const { container } = render(
      <AIOverlays isMonitoring={true} analysis={analysis} />
    );
    // Check the sidebar has mobile-hidden classes
    const sidebar = container.querySelector(".-translate-x-full");
    expect(sidebar).toBeTruthy();
  });
});

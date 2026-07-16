import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./status-badge";
import { EscrowStatus } from "@/types";

describe("StatusBadge (component rendering)", () => {
  it("renders the label for each status", () => {
    render(<StatusBadge status={EscrowStatus.Funded} />);
    expect(screen.getByText("Funded")).toBeInTheDocument();
  });

  it("renders disputed status", () => {
    render(<StatusBadge status={EscrowStatus.Disputed} />);
    expect(screen.getByText("Disputed")).toBeInTheDocument();
  });

  it("renders released status", () => {
    render(<StatusBadge status={EscrowStatus.Released} />);
    expect(screen.getByText("Released")).toBeInTheDocument();
  });
});

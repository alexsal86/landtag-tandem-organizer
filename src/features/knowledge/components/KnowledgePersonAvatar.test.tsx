import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  KnowledgePersonAvatar,
  KnowledgePersonLabel,
} from "./KnowledgePersonAvatar";

const person = {
  user_id: "alice",
  display_name: "Alice Beispiel",
  avatar_url: null,
};
afterEach(() => vi.restoreAllMocks());

it("renders a decorative 24px fallback and keeps the name visible as text", () => {
  const { container } = render(<KnowledgePersonLabel person={person} />);
  const avatar = container.querySelector('[title="Alice Beispiel"]');
  expect(avatar).toHaveAttribute("aria-hidden", "true");
  expect(avatar).toHaveClass("h-6", "w-6");
  expect(screen.getByText("AB")).toBeInTheDocument();
  expect(screen.getByText("Alice Beispiel")).toBeVisible();
});

it("renders the dashed unassigned circle with the requested label", () => {
  const { container } = render(<KnowledgePersonLabel person={null} />);
  const avatar = container.querySelector('[title="Nicht zugeordnet"]');
  expect(avatar).toHaveAttribute("aria-label", "Nicht zugeordnet");
  expect(avatar).toHaveClass("border-dashed");
  expect(screen.getByText("?")).toBeInTheDocument();
  expect(screen.getByText("Nicht zugeordnet")).toBeVisible();
});

it("omits avatar markup entirely in search-result presentation", () => {
  const { container } = render(
    <KnowledgePersonLabel
      person={{ ...person, avatar_url: "/avatar.png" }}
      showAvatar={false}
    />,
  );
  expect(screen.getByText("Alice Beispiel")).toBeVisible();
  expect(container.querySelector("[aria-hidden]")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
});

it("uses lazy decorative images and retains initials when an image fails", () => {
  const preloads: HTMLImageElement[] = [];
  vi.spyOn(window, "Image").mockImplementation(function () {
    const image = document.createElement("img");
    preloads.push(image);
    return image;
  });
  const { container, rerender } = render(
    <KnowledgePersonAvatar person={{ ...person, avatar_url: "/valid.png" }} />,
  );
  act(() => {
    Object.defineProperty(preloads[0], "complete", { value: true });
    Object.defineProperty(preloads[0], "naturalWidth", { value: 24 });
    preloads[0].dispatchEvent(new Event("load"));
  });
  expect(container.querySelector("img")).toHaveAttribute("loading", "lazy");
  expect(container.querySelector("img")).toHaveAttribute("alt", "");
  rerender(
    <KnowledgePersonAvatar person={{ ...person, avatar_url: "/broken.png" }} />,
  );
  act(() => {
    preloads[preloads.length - 1].dispatchEvent(new Event("error"));
  });
  expect(screen.getByText("AB")).toBeInTheDocument();
  expect(container.querySelector("img")).toBeNull();
});

it("does not start the Radix preload until an avatar approaches the viewport", () => {
  const original = Object.getOwnPropertyDescriptor(
    window,
    "IntersectionObserver",
  );
  let notify!: IntersectionObserverCallback;
  const disconnect = vi.fn();
  const image = vi.spyOn(window, "Image");
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    value: class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  });
  try {
    render(
      <KnowledgePersonAvatar
        person={{ ...person, avatar_url: "/offscreen.png" }}
      />,
    );
    expect(image).not.toHaveBeenCalled();
    act(() =>
      notify(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(image).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalled();
  } finally {
    if (original)
      Object.defineProperty(window, "IntersectionObserver", original);
    else Reflect.deleteProperty(window, "IntersectionObserver");
  }
});

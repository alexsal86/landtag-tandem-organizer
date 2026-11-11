import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("../hooks/useKnowledgeQuestions", () => ({
  useKnowledgeWrite: () => ({ mutateAsync: state.write, isPending: false }),
}));
import { AssigneeSelect } from "./AssigneeSelect";

const clara = {
  user_id: "clara",
  display_name: "Clara Beispiel",
  avatar_url: null,
};
beforeEach(() => {
  state.write.mockResolvedValue({});
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

it("offers avatars with text labels and assigns through the revision-checked RPC", async () => {
  render(
    <AssigneeSelect
      question={{
        id: "q",
        revision: 7,
        assigned_to: null,
        assigned_to_person: null,
      }}
      profiles={[clara]}
      assignable={[clara]}
    />,
  );
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Zuständig" }), {
    key: "ArrowDown",
  });
  const option = await screen.findByRole("option", { name: "Clara Beispiel" });
  expect(
    option.querySelector('[aria-hidden="true"][title="Clara Beispiel"]'),
  ).toBeInTheDocument();
  fireEvent.keyDown(option, { key: "Enter" });
  await waitFor(() =>
    expect(state.write).toHaveBeenCalledWith({
      name: "knowledge_qa_set_assignee",
      args: { p_question: "q", p_expected_revision: 7, p_assigned_to: "clara" },
    }),
  );
});

it("clears an assignment with null and renders text-only options in search results", async () => {
  render(
    <AssigneeSelect
      question={{
        id: "q",
        revision: 8,
        assigned_to: "clara",
        assigned_to_person: clara,
      }}
      profiles={[clara]}
      assignable={[clara]}
      showAvatars={false}
    />,
  );
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Zuständig" }), {
    key: "ArrowDown",
  });
  const option = await screen.findByRole("option", {
    name: "Nicht zugeordnet",
  });
  expect(option.querySelector('[title="Nicht zugeordnet"]')).toBeNull();
  fireEvent.keyDown(option, { key: "Enter" });
  await waitFor(() =>
    expect(state.write).toHaveBeenCalledWith({
      name: "knowledge_qa_set_assignee",
      args: { p_question: "q", p_expected_revision: 8, p_assigned_to: null },
    }),
  );
});

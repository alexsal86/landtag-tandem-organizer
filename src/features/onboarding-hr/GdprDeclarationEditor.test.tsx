import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GdprDeclarationEditor } from "./GdprDeclarationEditor";
import { DEFAULT_GDPR_DECLARATION } from "./gdpr";
afterEach(cleanup);

it("saves edits against the opened version and closes only on success", async () => {
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<GdprDeclarationEditor declaration={DEFAULT_GDPR_DECLARATION} busy={false} onSave={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Datenschutztext bearbeiten" }));
  const field = screen.getByLabelText("Text der Verpflichtung");
  expect(field).toHaveValue(DEFAULT_GDPR_DECLARATION.text);
  expect(screen.getByRole("button", { name: "Neue Fassung speichern" })).toBeDisabled();
  fireEvent.change(field, { target: { value: "Zu kurz" } });
  expect(screen.getByRole("button", { name: "Neue Fassung speichern" })).toBeDisabled();
  const edited = DEFAULT_GDPR_DECLARATION.text + "\nErgänzung des Büros.";
  fireEvent.change(field, { target: { value: edited } });
  fireEvent.click(screen.getByRole("button", { name: "Neue Fassung speichern" }));
  await screen.findByRole("alert");
  expect(field).toHaveValue(edited);
  expect(save).toHaveBeenCalledWith(edited, DEFAULT_GDPR_DECLARATION.version);
  fireEvent.click(screen.getByRole("button", { name: "Neue Fassung speichern" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("status")).toHaveTextContent("neue Fassung gespeichert");
});

it("cancels edits without saving", () => {
  const save = vi.fn();
  render(<GdprDeclarationEditor declaration={DEFAULT_GDPR_DECLARATION} busy={false} onSave={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Datenschutztext bearbeiten" }));
  fireEvent.change(screen.getByLabelText("Text der Verpflichtung"), { target: { value: "Entwurf" } });
  fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Datenschutztext bearbeiten" }));
  expect(screen.getByLabelText("Text der Verpflichtung")).toHaveValue(DEFAULT_GDPR_DECLARATION.text);
});

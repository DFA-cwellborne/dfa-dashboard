// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { publicEnv } from "@/config/publicEnv";
import { PasswordGate } from "./PasswordGate";

// A fake test-only password/hash pair, not any real staff password.
// printf '%s' "test-password-123" | shasum -a 256
const TEST_HASH = "7c13ab2e1d157284ccb11e9737f90cbb611b0acdb8f8dcd4e303a680e58a8b1b";
const TEST_PASSWORD = "test-password-123";

afterEach(() => {
  cleanup();
  localStorage.clear();
  publicEnv.dashboardPasswordHash = undefined;
});

describe("PasswordGate", () => {
  it("skips the gate entirely when no password is configured (local dev)", async () => {
    publicEnv.dashboardPasswordHash = undefined;
    render(
      <PasswordGate>
        <div>Secret dashboard</div>
      </PasswordGate>
    );
    expect(await screen.findByText("Secret dashboard")).toBeTruthy();
    expect(screen.queryByLabelText("Staff password")).toBeNull();
  });

  it("blocks content behind a password form when a password is configured", async () => {
    publicEnv.dashboardPasswordHash = TEST_HASH;
    render(
      <PasswordGate>
        <div>Secret dashboard</div>
      </PasswordGate>
    );
    expect(await screen.findByLabelText("Staff password")).toBeTruthy();
    expect(screen.queryByText("Secret dashboard")).toBeNull();
  });

  it("rejects the wrong password with a visible error, and keeps content hidden", async () => {
    publicEnv.dashboardPasswordHash = TEST_HASH;
    render(
      <PasswordGate>
        <div>Secret dashboard</div>
      </PasswordGate>
    );
    fireEvent.change(await screen.findByLabelText("Staff password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Incorrect password.");
    expect(screen.queryByText("Secret dashboard")).toBeNull();
  });

  it("unlocks on the correct password and shows the content", async () => {
    publicEnv.dashboardPasswordHash = TEST_HASH;
    render(
      <PasswordGate>
        <div>Secret dashboard</div>
      </PasswordGate>
    );
    fireEvent.change(await screen.findByLabelText("Staff password"), { target: { value: TEST_PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Secret dashboard")).toBeTruthy();
  });

  it("stays unlocked on remount — e.g. a page refresh — without re-entering the password", async () => {
    publicEnv.dashboardPasswordHash = TEST_HASH;
    const { unmount } = render(
      <PasswordGate>
        <div>Secret dashboard</div>
      </PasswordGate>
    );
    fireEvent.change(await screen.findByLabelText("Staff password"), { target: { value: TEST_PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Secret dashboard");
    unmount();

    render(
      <PasswordGate>
        <div>Secret dashboard</div>
      </PasswordGate>
    );
    expect(await screen.findByText("Secret dashboard")).toBeTruthy();
  });

  it("re-locks automatically if the configured password changes, even with an old unlock still stored", async () => {
    localStorage.setItem("dfa-dashboard-unlocked", "some-old-hash-from-a-previous-password");
    publicEnv.dashboardPasswordHash = TEST_HASH;
    render(
      <PasswordGate>
        <div>Secret dashboard</div>
      </PasswordGate>
    );
    expect(await screen.findByLabelText("Staff password")).toBeTruthy();
    expect(screen.queryByText("Secret dashboard")).toBeNull();
  });

  it("clears a stale error as soon as the visitor starts typing again", async () => {
    publicEnv.dashboardPasswordHash = TEST_HASH;
    render(
      <PasswordGate>
        <div>Secret dashboard</div>
      </PasswordGate>
    );
    const input = await screen.findByLabelText("Staff password");
    fireEvent.change(input, { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("alert");

    fireEvent.change(input, { target: { value: "w" } });
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});

import { test, expect } from "@playwright/test";

test("customer → owner → invoice → chatbot, responsive and persistent", async ({
  page,
  request,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Book your visit" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Book my appointment" }).click();
  await expect(page.getByText("Enter at least 2 characters.")).toBeVisible();
  const config = await (await request.get("/config")).json();
  const date = new Date(config.today + "T12:00:00");
  date.setDate(date.getDate() + (testInfo.project.name === "mobile" ? 8 : 7));
  const day = date.toISOString().slice(0, 10);
  const name = "Browser " + testInfo.project.name + " " + Date.now();
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Phone number" }).fill("9123456780");
  await page.getByLabel("Preferred date").fill(day);
  await expect(
    page.getByRole("button", { name: "9:00 am", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "9:00 am", exact: true }).click();
  await page.getByRole("button", { name: "Book my appointment" }).click();
  await expect(
    page.getByRole("heading", { name: "Your moment is reserved." }),
  ).toBeVisible();
  await expect(page.locator(".confirmation-details")).toContainText("Haircut");
  await expect(page.locator(".confirmation-details")).toContainText("₹200");
  const ref = (
    await page.locator(".confirmation-details small").innerText()
  ).split(": ")[1];
  const nav = async (label: string) => {
    if (testInfo.project.name === "mobile")
      await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page.getByRole("button", { name: label, exact: true }).click();
  };
  await nav("Owner dashboard");
  await page.getByLabel("Owner password").fill("e2e-owner-password");
  await page.getByRole("button", { name: "Open owner workspace" }).click();
  await page.getByLabel("Filter date").fill(day);
  await expect(
    page.locator(".appointment").filter({ hasText: ref }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("Filter date").fill(day);
  const appointment = page.locator(".appointment").filter({ hasText: ref });
  await expect(appointment).toBeVisible();
  await appointment
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(appointment.locator(".badge")).toHaveText("Confirmed");
  await appointment.getByRole("button", { name: "Reschedule" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("New time").selectOption("11:00");
  await page.getByRole("button", { name: "Save new appointment" }).click();
  await expect(appointment.locator(".appointment-time strong")).toHaveText(
    "11:00 am",
  );
  const availability = await (
    await request.get(`/availability?date=${day}&service_id=1`)
  ).json();
  expect(availability.slots).toContain("09:00");
  expect(availability.slots).not.toContain("11:00");
  await nav("Billing");
  await page.getByLabel("Customer / appointment").selectOption(ref);
  await page.getByRole("button", { name: "Add Facial", exact: true }).click();
  await page.getByRole("button", { name: "Generate invoice" }).click();
  await expect(page.locator(".invoice-preview")).toContainText("₹700");
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page
      .getByRole("button", { name: "Print / Save as PDF", exact: true })
      .click(),
  ]);
  await expect(popup.getByRole("heading", { name: /INV-/ })).toBeVisible();
  await expect(popup.locator("body")).toContainText("₹700.00");
  await popup.close();
  await nav("Owner dashboard");
  await page.getByLabel("Filter date").fill(day);
  page.once("dialog", (d) => d.accept());
  await page
    .locator(".appointment")
    .filter({ hasText: ref })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.locator(".appointment").filter({ hasText: ref }).locator(".badge"),
  ).toHaveText("Cancelled");
  await nav("Book a visit");
  await page.getByRole("button", { name: "Open salon assistant" }).click();
  await page
    .getByRole("button", { name: "Haircut ka price kitna hai?" })
    .click();
  await expect(page.locator(".chat-bubble.assistant").last()).toContainText(
    "₹200",
  );
  await page
    .getByRole("textbox", { name: "Message salon assistant" })
    .fill("Mala facial chi price sanga.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".chat-bubble.assistant").last()).toContainText(
    "₹500",
  );
  await page.getByRole("button", { name: "Close chat" }).click();
  await page.screenshot({
    path: `/tmp/atelier-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

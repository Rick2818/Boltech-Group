# Invoices against purchase orders

Status: APPROVED (2026-11-05) · Suggested offer: implementation · Price: quoted after scope review

## Problem

Price or quantity differences are found at payment time, when it is already too late.

## What we deliver

- Invoice matched to its purchase order
- Every difference flagged with a reason
- Amount in dispute per document
- Finance approves or rejects

## Acceptance criteria

Thirty test invoices with seeded differences are caught, each with a reason and an amount, with no invented differences.

## What we do not promise

We do not promise to read invoices with no legible text; that is validated before quoting.

## Fifteen-minute demo

Three invoices with a known difference are processed, and the total amount at risk is shown.

## Proposed integrations

- gmail (requires technical validation)
- google-drive (requires technical validation)
- google-sheets (requires technical validation)

---

## Internal review notes

- Asset approved by the owner on 2026-11-05.
- No published price: quoted after scope review.
- No integration is connected without technical validation.
- The agent never buys, pays or sends on its own.
- Legal text pending before publication (see docs/LEGAL-MINIMO.md).

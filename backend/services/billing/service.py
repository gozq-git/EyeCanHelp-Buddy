# isort: skip_file
from dataclasses import dataclass
from typing import Protocol
from typing import TypedDict

import sqlalchemy as sa
from sqlalchemy.ext import asyncio as sa_asyncio

from .model import BillingPrice


class BillingEstimate(TypedDict):
	estimated_cost_min: float
	estimated_cost_max: float
	max_medisave_claimable: float


class BillingPriceNotConfiguredError(ValueError):
	pass


class InvalidBillingClassError(ValueError):
	pass


@dataclass(frozen=True)
class BillingContext:
	record_class: str
	performer: str
	injections: int
	billing_tier: str


class BillingStrategy(Protocol):
	def estimate(self, context: BillingContext, rate: BillingPrice) -> BillingEstimate:
		...


_RECORD_CLASS_TO_TIER: dict[str, str] = {
	"PTE": "private",
	"SUB": "subsidised",
}

_RECORD_CLASS_ALIASES: dict[str, str] = {
	"PTE": "PTE",
	"PRIVATE": "PTE",
	"SUB": "SUB",
	"SUBSIDISED": "SUB",
	"SUBSIDIZED": "SUB",
}


def _normalize_record_class(record_class: str | None) -> str:
	class_code = (record_class or "").strip().upper()
	normalized = _RECORD_CLASS_ALIASES.get(class_code)
	if normalized is None:
		raise InvalidBillingClassError(
			"record_class must be either private or subsidised",
		)
	return normalized


def _build_estimate(min_per_injection: float, max_per_injection: float, injections: int, max_medisave_claimable: float) -> BillingEstimate:
	count = max(1, int(injections or 1))
	return {
		"estimated_cost_min": min_per_injection * count,
		"estimated_cost_max": max_per_injection * count,
		"max_medisave_claimable": max_medisave_claimable,
	}


class PrivateBillingStrategy:
	def estimate(self, context: BillingContext, rate: BillingPrice) -> BillingEstimate:
		return _build_estimate(
			rate.min_per_injection,
			rate.max_per_injection,
			context.injections,
			rate.max_medisave_claimable,
		)


class SubsidisedBillingStrategy:
	def estimate(self, context: BillingContext, rate: BillingPrice) -> BillingEstimate:
		return _build_estimate(
			rate.min_per_injection,
			rate.max_per_injection,
			context.injections,
			rate.max_medisave_claimable,
		)


class BillingStrategyRegistry:
	"""Resolves billing behavior by record class."""

	def __init__(self, by_record_class: dict[str, BillingStrategy]):
		self._by_record_class = {k.upper(): v for k, v in by_record_class.items()}

	def resolve(self, record_class: str) -> BillingStrategy:
		strategy = self._by_record_class.get((record_class or "").upper())
		if strategy is None:
			raise InvalidBillingClassError(
				"record_class must be either private or subsidised",
			)
		return strategy


_strategy_registry = BillingStrategyRegistry(
	by_record_class={
		"PTE": PrivateBillingStrategy(),
		"SUB": SubsidisedBillingStrategy(),
	},
)


async def estimate_bill_from_db(
	record_class: str | None,
	performer: str | None,
	injections: int | None,
	db: sa_asyncio.AsyncSession,
) -> BillingEstimate:
	class_code = _normalize_record_class(record_class)
	performer_code = (performer or "").upper()
	billing_tier = _RECORD_CLASS_TO_TIER[class_code]
	context = BillingContext(record_class=class_code, performer=performer_code, injections=int(injections or 1), billing_tier=billing_tier)

	stmt = sa.select(BillingPrice).where(
		sa.func.upper(BillingPrice.record_class) == class_code,
		sa.func.upper(BillingPrice.performer) == performer_code,
	)
	result = await db.execute(stmt)
	rate = result.scalar_one_or_none()

	if rate is None:
		raise BillingPriceNotConfiguredError(
			f"No billing price configured for class={class_code!r}, performer={performer_code!r}",
		)

	strategy = _strategy_registry.resolve(class_code)
	return strategy.estimate(context, rate)

__all__ = [
	"BillingEstimate",
	"BillingPriceNotConfiguredError",
	"InvalidBillingClassError",
	"estimate_bill_from_db",
]

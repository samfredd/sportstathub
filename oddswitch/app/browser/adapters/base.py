"""
OddSwitch Engine — Abstract Bookmaker Adapter.

All bookmaker-specific browser automation inherits from this base.
Each adapter must implement resolve + generate.

To add a new bookmaker:
  1. Create a new file in app/browser/adapters/
  2. Inherit from BookmakerAdapter
  3. Implement resolve_booking_code() and generate_booking_code()
  4. Register in ADAPTER_REGISTRY below
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.schemas.canonical import RawSlip


class BookmakerAdapter(ABC):
    """
    Abstract base for all bookmaker browser adapters.

    Each adapter encapsulates:
    - How to load a booking code on the bookmaker's site
    - How to extract slip data from the page
    - How to place selections and generate a new booking code
    """

    bookmaker_id: str = ""

    @abstractmethod
    async def resolve_booking_code(self, code: str) -> RawSlip:
        """
        Load a booking code on the bookmaker site and extract the slip.

        Args:
            code: The booking code to resolve

        Returns:
            RawSlip with all extracted leg data
        """
        ...

    @abstractmethod
    async def generate_booking_code(self, slip_data: dict) -> str:
        """
        Place selections on the bookmaker site and get a booking code.

        Args:
            slip_data: Dict with legs, events, markets, selections

        Returns:
            The generated booking code string
        """
        ...

    async def close(self) -> None:
        """Clean up adapter resources. Override if needed."""
        pass

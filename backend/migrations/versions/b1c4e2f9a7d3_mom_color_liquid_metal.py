"""Mom's colour: liquid metal purple

Revision ID: b1c4e2f9a7d3
Revises: 636c8194274e
Create Date: 2026-09-26 18:30:00

Data-only migration. Darkens Mom's seeded colour from #a371f7 to #8a5cf0 so her
badge keeps its contrast on the new glass surfaces. Only the untouched seed value
is changed; a colour someone set by hand is left alone.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c4e2f9a7d3'
down_revision: Union[str, Sequence[str], None] = '636c8194274e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD = "#a371f7"
NEW = "#8a5cf0"


def upgrade() -> None:
    op.execute(
        sa.text("UPDATE people SET color = :new WHERE slug = 'mom' AND lower(color) = :old")
        .bindparams(new=NEW, old=OLD)
    )


def downgrade() -> None:
    op.execute(
        sa.text("UPDATE people SET color = :old WHERE slug = 'mom' AND lower(color) = :new")
        .bindparams(new=NEW, old=OLD)
    )

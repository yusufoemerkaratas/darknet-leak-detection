from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, JSON
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()

class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    url = Column(String(512), nullable=False)
    is_active = Column(Boolean, default=True)
    leak_records = relationship("LeakRecord", back_populates="source", cascade="all, delete-orphan")


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    leak_records = relationship("LeakRecord", back_populates="company", cascade="all, delete-orphan")


class LeakRecord(Base):
    __tablename__ = "leak_records"
    __table_args__ = (
        Index("ix_leak_records_content_hash", "content_hash", unique=True),
        Index("ix_leak_records_published_at", "published_at"),
        Index("ix_leak_records_source_id", "source_id"),
        Index("ix_leak_records_company_id", "company_id"),
        Index("ix_leak_records_published_collected", "published_at", "collected_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    content_hash = Column(String(64), nullable=False)
    raw_url = Column(String(512), nullable=False)
    severity = Column(String(32), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=False)
    collected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    source = relationship("Source", back_populates="leak_records")
    company = relationship("Company", back_populates="leak_records")
    analysis_result = relationship("AnalysisResult", back_populates="leak_record", uselist=False, cascade="all, delete-orphan")


class AnalysisResult(Base):
    __tablename__ = "analysis_result"

    id = Column(Integer, primary_key=True, index=True)
    leak_record_id = Column(Integer, ForeignKey("leak_records.id", ondelete="CASCADE"), nullable=False, unique=True)
    detected_patterns = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    leak_record = relationship("LeakRecord", back_populates="analysis_result")



class CrawlJob(Base):
    __tablename__ = "crawl_jobs"

    __table_args__ = (
        Index("ix_crawl_jobs_source_id", "source_id"),
        Index("ix_crawl_jobs_status", "status"),
        Index("ix_crawl_jobs_started_at", "started_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"))

    status = Column(String, default="running")
    total_records = Column(Integer, default=0)
    inserted_records = Column(Integer, default=0)
    duplicate_records = Column(Integer, default=0)

    started_at = Column(DateTime)
    finished_at = Column(DateTime)
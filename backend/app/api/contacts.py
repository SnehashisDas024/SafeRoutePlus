from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.schema import TrustedContact
from app.deps import get_current_user
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter(prefix="/contacts", tags=["Contacts"])

class ContactCreate(BaseModel):
    name: str
    phone: str
    tier: str = 'secondary'  # 'primary' | 'secondary'
    priority: int = 1

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    tier: Optional[str] = None
    priority: Optional[int] = None

class ContactResponse(BaseModel):
    id: str
    user_id: str
    name: str
    phone: str
    tier: str
    priority: int

    class Config:
        from_attributes = True

@router.get("", response_model=list[ContactResponse])
async def list_contacts(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    contacts = db.query(TrustedContact).filter(TrustedContact.user_id == user_id).order_by(TrustedContact.priority).all()
    return contacts

@router.post("", response_model=ContactResponse)
async def create_contact(req: ContactCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    contact = TrustedContact(
        id=str(uuid.uuid4()),
        user_id=user_id,
        name=req.name,
        phone=req.phone,
        tier=req.tier,
        priority=req.priority,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact

@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(contact_id: str, req: ContactUpdate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    contact = db.query(TrustedContact).filter(TrustedContact.id == contact_id, TrustedContact.user_id == user_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    if req.name is not None:
        contact.name = req.name
    if req.phone is not None:
        contact.phone = req.phone
    if req.tier is not None:
        contact.tier = req.tier
    if req.priority is not None:
        contact.priority = req.priority
    
    db.commit()
    db.refresh(contact)
    return contact

@router.delete("/{contact_id}")
async def delete_contact(contact_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    contact = db.query(TrustedContact).filter(TrustedContact.id == contact_id, TrustedContact.user_id == user_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    db.delete(contact)
    db.commit()
    return {"status": "deleted"}
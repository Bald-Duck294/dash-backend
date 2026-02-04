import prisma from "../config/prismaClient.mjs";
import {
  parsePaginationParams,
  paginateWithPrisma,
} from "../utils/pagination.js";
import { serializeBigInt } from "../utils/serializer.js";

// @desc    Create a new company
// @route   POST /api/companies
// @access  Public
export const createCompany = async (req, res) => {
  try {
    const { name, description, contact_email } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Company name is required" });
    }

    const newCompany = await prisma.companies.create({
      data: {
        name,
        description,
        contact_email,
      },
    });

    res.status(201).json(serializeBigInt(newCompany));
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({ message: "Failed to create company" });
  }
};

export const getAllCompanies = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  try {
    // const companies = await prisma.companies.findMany({
    //   orderBy: {
    //     created_at: "desc",
    //   },
    // });

    const { data, meta } = await paginateWithPrisma(prisma.companies, {
      orderBy: {
        created_at: "desc",
      },
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.status(200).json({
      data: serializeBigInt(data),
      pagination: meta,
    });
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ message: "Failed to fetch companies" });
  }
};

// @desc    Get a single company by ID
// @route   GET /api/companies/:id
// @access  Public
export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await prisma.companies.findUnique({
      where: { id: parseInt(id) },
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }
    res.status(200).json(serializeBigInt(company));
  } catch (error) {
    console.error("Error fetching company:", error);
    res.status(500).json({ message: "Failed to fetch company" });
  }
};

// @desc    Update a company
// @route   POST /api/companies/:id
// @access  Public
export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, contact_email } = req.body;

    console.log(req.body, "req body");

    if (!name) {
      return res.status(400).json({ message: "Company name is required" });
    }

    const updatedCompany = await prisma.companies.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        contact_email,
        updated_at: new Date(),
      },
    });

    res.status(200).json(serializeBigInt(updatedCompany));
  } catch (error) {
    console.error("Error updating company:", error);
    if (error.code === "P2025") {
      // Prisma code for record not found
      return res.status(404).json({ message: "Company not found" });
    }
    res.status(500).json({ message: "Failed to update company" });
  }
};

// @desc    Delete a company
// @route   DELETE /api/companies/:id
// @access  Public
export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.companies.delete({
      where: { id: parseInt(id) },
    });

    res.status(204).send(); // No Content
  } catch (error) {
    console.error("Error deleting company:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Company not found" });
    }
    res.status(500).json({ message: "Failed to delete company" });
  }
};

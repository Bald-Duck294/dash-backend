import prisma from "../config/prismaClient.mjs";
import bcrypt from "bcryptjs";
import express from "express";
import RBACFilterService from "../utils/rbacFilterService.js";

// withoud any role id
// export async function getUser(req, res) {

//   try {

//     const { companyId } = req.query;

//     console.log(companyId, "companyId")
//     const users = await prisma.users.findMany({
//       where: {
//         company_id: companyId,
//       },

//       include: {
//         role: true
//       }
//     });
//     // console.log(users, "users");

//     // Convert BigInt to string
//     const usersWithStringIds = users.map((user) => ({
//       ...user,
//       id: user.id.toString(),
//       company_id: user.company_id?.toString() || null,
//     }));

//     console.log(usersWithStringIds, "ids");
//     res.json(usersWithStringIds);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ msg: "Error fetching users", err });
//   }
// }

// export async function getUser(req, res) {
//   try {
//     const { companyId } = req.query;
//     const currentUser = req.user; // From auth middleware
//     // console.log(companyId, "companyId");
//     // console.log(currentUser, "current user");

//     // Step 1: Get role-based filter
//     const userFilter = await RBACFilterService.getUserFilter(
//       currentUser,
//       "getUser",
//     );

//     // console.log(userFilter, "user filter from rbac service");
//     // Step 2: Build complete where clause
//     const whereClause = {
//       company_id: companyId,
//       ...userFilter, // Merge filter from getUserFilter
//     };

//     // console.log(whereClause, "final where clause");

//     // Step 3: Fetch filtered users
//     const users = await prisma.users.findMany({
//       where: whereClause,
//       include: {
//         role: true,
//         cleaner_assignments_as_cleaner: {
//           where: {
//             deleted_at: null,
//           },
//           select: {
//             name: true,

//             locations: {
//               select: {
//                 name: true,
//               },
//             },
//           },
//         },
//       },
//       orderBy: { id: "desc" },
//     });

//     // Convert BigInt to string
//     const usersWithStringIds = users.map((user) => ({
//       ...user,
//       id: user.id.toString(),
//       company_id: user.company_id?.toString() || null,
//     }));

//     // console.log(usersWithStringIds, "filtered users");
//     res.json(usersWithStringIds);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ msg: "Error fetching users", err });
//   }
// }

export async function getUser(req, res) {
  try {
    const { companyId, roleId } = req.query;
    const currentUser = req.user;

    const userFilter = await RBACFilterService.getUserFilter(
      currentUser,
      "getUser",
    );

    const whereClause = {
      ...userFilter,
    };

    // Only add company filter if provided
    if (companyId) {
      whereClause.company_id = BigInt(companyId);
    }

    // Only add role filter if provided
    if (roleId) {
      whereClause.role_id = Number(roleId);
      // use BigInt(roleId) if your schema uses BigInt
    }

    const users = await prisma.users.findMany({
      where: whereClause,
      include: {
        role: true,
        cleaner_assignments_as_cleaner: {
          where: { deleted_at: null },
          select: {
            name: true,
            locations: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { id: "desc" },
    });

    const usersWithStringIds = users.map((user) => ({
      ...user,
      id: user.id.toString(),
      company_id: user.company_id?.toString() || null,
    }));

    res.json(usersWithStringIds);
  } catch (err) {
    console.error(err);
    res.status(500).send({ msg: "Error fetching users", err });
  }
}

// export async function getUserById(req, res) {
//   try {
//     const { id } = req.params;
//     console.log('Getting user by ID:', id);

//     const user = await prisma.users.findUnique({
//       where: { id: BigInt(id) },
//       include: {
//         role: {
//           select: {
//             id: true,
//             name: true,
//             description: true
//           }
//         },
//         companies: {
//           select: {
//             id: true,
//             name: true,
//             description: true
//           }
//         },
//         location_assignments: {
//           where: { is_active: true },
//           include: {
//             location: {
//               select: {
//                 id: true,
//                 name: true,
//                 latitude: true,
//                 longitude: true
//               }
//             }
//           }
//         },
//         // Include other relationships if needed
//         cleaner_assignments_as_cleaner: {
//           include: {
//             locations: {
//               select: { id: true, name: true }
//             }
//           }
//         },
//         cleaner_assignments_as_supervisor: {
//           include: {
//             locations: {
//               select: { id: true, name: true }
//             }
//           }
//         }
//       }
//     });

//     console.log(user, "user")
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Convert BigInt to string and format response
//     const safeUser = {
//       ...user,
//       id: user.id.toString(),
//       company_id: user.company_id?.toString() || null,
//       location_assignments: user.location_assignments?.map(assignment => ({
//         ...assignment,
//         id: assignment.id.toString(),
//         location_id: assignment.location_id.toString(),
//         user_id: assignment.user_id.toString(),
//         location: {
//           ...assignment.location,
//           id: assignment.location.id.toString()
//         }
//       })) || [],
//       cleaner_assignments_as_cleaner: user.cleaner_assignments_as_cleaner?.map(assignment => ({
//         ...assignment,
//         id: assignment.id.toString(),
//         cleaner_user_id: assignment.cleaner_user_id.toString(),
//         location_id: assignment.location_id?.toString() || null,
//         locations: assignment.locations ? {
//           ...assignment.locations,
//           id: assignment.locations.id.toString()
//         } : null
//       })) || [],
//       cleaner_assignments_as_supervisor: user.cleaner_assignments_as_supervisor?.map(assignment => ({
//         ...assignment,
//         id: assignment.id.toString(),
//         supervisor_id: assignment.supervisor_id?.toString() || null,
//         location_id: assignment.location_id?.toString() || null,
//         locations: assignment.locations ? {
//           ...assignment.locations,
//           id: assignment.locations.id.toString()
//         } : null
//       })) || []
//     };

//     console.log('User found:', safeUser.name);
//     res.json(safeUser);
//   } catch (err) {
//     console.error('Error in getUserById:', err);
//     res.status(500).json({ message: "Error fetching user", error: err.message });
//   }
// }

export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    console.log("Getting user by ID:", id);

    const user = await prisma.users.findUnique({
      where: { id: BigInt(id) },
      include: {
        role: true,
        companies: true,
        cleaner_assignments_as_cleaner: {
          where: {
            deleted_at: null,
          },
          select: {
            id: true,
            name: true,
            status: true,
            assigned_on: true,
            location_id: true,
            locations: {
              select: {
                id: true,
                name: true,
                address: true,
                city: true,
                state: true,
                latitude: true,
                longitude: true,
                pincode: true,
                type_id: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // console.log(user, "single user");
    // console.log(JSON.stringify(user, null, 2), "single strigny useer"); // Pretty printed JSON

    console.dir(user, { depth: null, colors: true });
    console.log("--- single user ---");

    // ✅ Manual conversion with proper handling
    const safeUser = {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      company_id: user.company_id?.toString() || null,
      age: user.age,
      birthdate: user.birthdate,
      role_id: user.role_id,
      created_at: user.created_at,
      updated_at: user.updated_at,

      // Role data
      role: user.role
        ? {
          id: user.role.id,
          name: user.role.name,
          description: user.role.description,
        }
        : null,

      // Company data
      companies: user.companies
        ? {
          id: user.companies.id.toString(), // ✅ Convert company BigInt
          name: user.companies.name,
          description: user.companies.description,
        }
        : null,

      location_assignments: user?.cleaner_assignments_as_cleaner
        ? user?.cleaner_assignments_as_cleaner.map((item) => ({
          ...item,
          id: item?.id?.toString(),
          location_id: item?.id?.toString(),
          locations: {
            ...item.locations,
            id: item?.locations?.id?.toString(),
            type_id: item?.locations?.type_id?.toString(),
          },
        }))
        : null,
    };

    // console.log('User found:', safeUser.name);
    console.log(safeUser, "safe usere");
    res.json(safeUser);
  } catch (err) {
    console.error("Error in getUserById:", err);
    res
      .status(500)
      .json({ message: "Error fetching user", error: err.message });
  }
}

// // Handles POST /api/users
// export const createUser = async (req, res) => {
//   console.log('in create user', req.body);
//   console.log('company ID from query:', req.query.companyId);

//   try {
//     const { password, location_ids , companyId = [], ...data } = req.body;
//     // const { companyId } = req.query; // Extract company_id from query params

//     console.log(companyId, "company id from the create user  ");
//     if (!password) {
//       return res.status(400).json({ message: "Password is required" });
//     }

//     if (!companyId) {
//       return res.status(400).json({ message: "Company ID is required" });
//     }

//     console.log('Hashing password...');
//     const hashedPassword = await bcrypt.hash(password, 10);

//     console.log('Creating user with company_id:', companyId);

//     // Helper function to serialize BigInt values
//     const serializeBigInt = (obj) => {
//       return JSON.parse(JSON.stringify(obj, (key, value) =>
//         typeof value === 'bigint' ? value.toString() : value
//       ));
//     };

//     const newUser = await prisma.users.create({
//       data: {
//         ...data,
//         password: hashedPassword,
//         company_id: BigInt(companyId), // Add company_id as BigInt
//         birthdate: data?.birthdate ? new Date(data.birthdate) : null,
//         ...(location_ids.length > 0 && {
//           location_assignments: {
//             create: location_ids.map((locId) => ({
//               location_id: BigInt(locId),
//             })),
//           },
//         }),
//       },
//       include: {
//         location_assignments: {
//           include: {
//             location: {
//               select: {
//                 id: true,
//                 name: true,
//                 address: true,
//               }
//             }
//           }
//         }
//       }
//     });

//     console.log('User created successfully:', newUser.id);

//     // Serialize the response to handle BigInt values
//     const safeUser = serializeBigInt({
//       ...newUser,
//       // Ensure all BigInt fields are properly converted
//       id: newUser.id.toString(),
//       company_id: newUser.company_id?.toString(),
//       location_assignments: newUser.location_assignments?.map(assignment => ({
//         ...assignment,
//         location_id: assignment.location_id.toString(),
//         user_id: assignment.user_id.toString(),
//         location: assignment.location ? {
//           ...assignment.location,
//           id: assignment.location.id.toString()
//         } : null
//       }))
//     });

//     console.log('Serialized user data:', safeUser);
//     res.status(201).json(safeUser);

//   } catch (error) {
//     console.error('Error in createUser:', error);

//     // Handle Prisma unique constraint violations
//     if (error.code === 'P2002') {
//       const fieldName = error.meta?.target?.join(', ') || 'field';
//       return res.status(409).json({
//         message: `User with this ${fieldName} already exists.`,
//         code: 'DUPLICATE_ENTRY'
//       });
//     }

//     // Handle foreign key constraint violations
//     if (error.code === 'P2003') {
//       return res.status(400).json({
//         message: "Invalid company ID or location ID provided.",
//         code: 'INVALID_REFERENCE'
//       });
//     }

//     // Handle other Prisma errors
//     if (error.code?.startsWith('P')) {
//       return res.status(400).json({
//         message: "Database constraint violation.",
//         code: error.code,
//         detail: error.message
//       });
//     }

//     // Generic error handling
//     res.status(500).json({
//       message: "Error creating user",
//       error: error.message,
//       code: 'INTERNAL_ERROR'
//     });
//   }
// };

export const createUser = async (req, res) => {
  console.log("in create user", req.body);

  try {
    const { password, location_ids = [], company_id, ...data } = req.body;
    // Extract company_id from the body, not query

    console.log(company_id, "company_id from body");

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    if (!company_id) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    console.log("Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log("Creating user with company_id:", company_id);

    // Helper function to serialize BigInt values
    const serializeBigInt = (obj) => {
      return JSON.parse(
        JSON.stringify(obj, (key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      );
    };

    const newUser = await prisma.users.create({
      data: {
        ...data,
        password: hashedPassword,
        company_id: BigInt(company_id), // Use company_id from body
        birthdate: data?.birthdate ? new Date(data.birthdate) : null,
        // ...(location_ids.length > 0 && {
        //   location_assignments: {
        //     create: location_ids.map((locId) => ({
        //       location_id: BigInt(locId),
        //     })),
        //   },
        // }),
      },
      include: {
        // location_assignments: {
        //   include: {
        //     location: {
        //       select: {
        //         id: true,
        //         name: true,
        //         // address: true,
        //       }
        //     }
        //   }
        // }
      },
    });

    console.log("User created successfully:", newUser.id);

    // Serialize the response to handle BigInt values
    const safeUser = serializeBigInt({
      ...newUser,
      id: newUser.id.toString(),
      company_id: newUser.company_id?.toString(),
      // location_assignments: newUser.location_assignments?.map(assignment => ({
      //   ...assignment,
      //   location_id: assignment.location_id.toString(),
      //   user_id: assignment.user_id.toString(),
      //   location: assignment.location ? {
      //     ...assignment.location,
      //     id: assignment.location.id.toString()
      //   } : null
      // }))
    });

    // console.log('Serialized user data:', safeUser);
    res.status(201).json(safeUser);
  } catch (error) {
    console.error("Error in createUser:", error);

    // Handle Prisma unique constraint violations
    if (error.code === "P2002") {
      const fieldName = error.meta?.target?.join(", ") || "field";
      return res.status(409).json({
        message: `User with this ${fieldName} already exists.`,
        code: "DUPLICATE_ENTRY",
      });
    }

    // Handle foreign key constraint violations
    if (error.code === "P2003") {
      return res.status(400).json({
        message: "Invalid company ID or location ID provided.",
        code: "INVALID_REFERENCE",
      });
    }

    // Handle other Prisma errors
    if (error.code?.startsWith("P")) {
      return res.status(400).json({
        message: "Database constraint violation.",
        code: error.code,
        detail: error.message,
      });
    }

    // Generic error handling
    res.status(500).json({
      message: "Error creating user",
      error: error.message,
      code: "INTERNAL_ERROR",
    });
  }
};

// --- UPDATE USER ---
export const updateUser = async (req, res) => {
  const userId = BigInt(req.params.id);
  try {
    const { password, location_ids, ...data } = req.body;

    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }
    if (data.birthdate) {
      data.birthdate = new Date(data.birthdate);
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      // ✅ Update user info
      const user = await tx.users.update({
        where: { id: userId },
        data,
      });

      // ✅ Handle location assignments if provided
      if (location_ids !== undefined) {
        // Only update if explicitly provided
        // First, deactivate all existing assignments for this user
        await tx.cleaner_assignments.updateMany({
          where: { cleaner_user_id: userId },
          data: { status: "unassigned", role_id: user?.role_id }, // Mark as unassigned instead of deleting
        });

        // Then, create/update new assignments
        if (Array.isArray(location_ids) && location_ids.length > 0) {
          for (const locId of location_ids) {
            await tx.cleaner_assignments.upsert({
              where: {
                // ✅ Use composite key from your schema
                id: BigInt(locId), // If updating existing assignment
              },
              update: {
                status: "assigned",
                updated_at: new Date(),
              },
              create: {
                cleaner_user_id: userId,
                location_id: BigInt(locId),
                company_id: BigInt(data.company_id), // ✅ Add company_id
                name: data.name, // ✅ Required field
                status: "assigned",
                assigned_on: new Date(),
              },
            });
          }
        }
      }

      return user;
    });

    // ✅ Serialize BigInt values
    const safeUser = JSON.parse(
      JSON.stringify(updatedUser, (key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );

    res.status(200).json({
      ...safeUser,
      birthdate: safeUser?.birthdate ? new Date(safeUser.birthdate) : null,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Error in updateUser:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        message: `User with this ${error.meta.target.join(", ")} already exists.`,
      });
    }

    if (error.code === "P2025") {
      return res.status(404).json({
        message: "User or assignment not found",
      });
    }

    res.status(500).json({
      message: "Error updating user",
      error: error.message,
    });
  }
};

// --- DELETE USER ---
// Handles DELETE /api/users/:id

export const deleteUser = async (req, res) => {
  const userId = BigInt(req.params.id);
  try {
    await prisma.users.delete({ where: { id: userId } });

    await prisma.cleaner_assignments.deleteMany({
      where: {
        cleaner_user_id: userId,
      },
    });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.log(error, "error");
    res
      .status(500)
      .json({ message: "Error deleting user", error: error.message });
  }
};

export const changeOwnPassword = async (req, res) => {
  try {
    // 🔐 userId MUST come from auth middleware
    const userId = BigInt(req.user.id);

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long",
      });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user || !user.password) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.users.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        updated_at: new Date(),
      },
    });

    res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("changeOwnPassword:", error);
    res.status(500).json({
      message: "Error updating password",
    });
  }
};
